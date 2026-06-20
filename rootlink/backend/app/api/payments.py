import logging

from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.marketplace import Listing, ListingOrder
from app.services import stripe_payments

logger = logging.getLogger("app.payments")

router = APIRouter(prefix="/api/payments", tags=["payments"])


@router.post("/webhook")
async def stripe_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    """Stripe webhook endpoint — receives payment events."""
    payload = await request.body()
    signature = request.headers.get("stripe-signature", "")

    event = stripe_payments.verify_webhook_event(payload, signature)
    if event is None:
        return Response(status_code=400, content="Webhook verification failed")

    event_type = event["type"]
    data = event["data"]["object"]

    if event_type == "checkout.session.completed":
        session_id = data.get("id")
        payment_intent_id = data.get("payment_intent")
        metadata = data.get("metadata", {})
        order_id = metadata.get("order_id")

        if order_id:
            result = await db.execute(
                select(ListingOrder).where(ListingOrder.id == int(order_id))
            )
            order = result.scalar_one_or_none()
            if order:
                order.payment_status = "paid"
                order.stripe_payment_intent_id = payment_intent_id
                order.stripe_checkout_session_id = session_id
                await db.commit()

                # Mark listing as sold if no quantity left
                listing_result = await db.execute(
                    select(Listing).where(Listing.id == order.listing_id)
                )
                listing = listing_result.scalar_one_or_none()
                if listing:
                    listing.quantity = max(0, (listing.quantity or 1) - order.quantity)
                    if listing.quantity <= 0:
                        listing.status = "sold"
                    await db.commit()

                logger.info(f"Order {order_id} paid via Stripe")

    elif event_type == "payment_intent.payment_failed":
        metadata = data.get("metadata", {})
        order_id = metadata.get("order_id")
        if order_id:
            result = await db.execute(
                select(ListingOrder).where(ListingOrder.id == int(order_id))
            )
            order = result.scalar_one_or_none()
            if order:
                order.payment_status = "failed"
                # Restore quantity since payment failed
                listing_result = await db.execute(
                    select(Listing).where(Listing.id == order.listing_id)
                )
                listing = listing_result.scalar_one_or_none()
                if listing:
                    listing.quantity += order.quantity
                    if listing.status == "sold":
                        listing.status = "active"
                await db.commit()
                logger.warning(f"Order {order_id} payment failed — quantity restored")

    elif event_type == "charge.refunded":
        metadata = data.get("metadata", {})
        order_id = metadata.get("order_id")
        if order_id:
            result = await db.execute(
                select(ListingOrder).where(ListingOrder.id == int(order_id))
            )
            order = result.scalar_one_or_none()
            if order:
                order.payment_status = "refunded"
                await db.commit()
                logger.info(f"Order {order_id} refunded")

    return {"status": "ok"}
