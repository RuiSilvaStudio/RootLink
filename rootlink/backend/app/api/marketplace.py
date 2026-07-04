import json
import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.permissions import rank_at_least
from app.core.permissions_registry import Rank
from app.core.security import get_current_user
from app.models.marketplace import Listing, ListingOrder, SellerStripeAccount
from app.models.user import User
from app.schemas.marketplace import (
    ListingCreate,
    ListingResponse,
    ListingUpdate,
    OrderResponse,
    SellerStatusResponse,
)
from app.services import stripe_payments

logger = logging.getLogger("app.marketplace")

router = APIRouter(prefix="/api/marketplace", tags=["marketplace"])

FRONTEND_URL = "http://localhost:3001"


def _listing_to_response(listing: Listing, seller_name: str | None = None, seller_verified: bool = False) -> ListingResponse:
    images = []
    if listing.images:
        try:
            images = json.loads(listing.images) if isinstance(listing.images, str) else listing.images
        except (json.JSONDecodeError, TypeError):
            images = []
    return ListingResponse(
        id=listing.id,
        seller_id=listing.seller_id,
        seller_name=seller_name,
        seller_verified=seller_verified,
        listing_type=listing.listing_type,
        title=listing.title,
        description=listing.description,
        family=listing.family,
        category=listing.category,
        condition=listing.condition,
        price_cents=listing.price_cents,
        currency=listing.currency,
        status=listing.status,
        location=listing.location,
        lat=listing.lat,
        lng=listing.lng,
        images=images,
        estimated_waste_diverted_kg=listing.estimated_waste_diverted_kg,
        swap_preferences=listing.swap_preferences,
        view_count=listing.view_count,
        quantity=listing.quantity,
        created_at=listing.created_at,
        updated_at=listing.updated_at,
    )


# ── Listings CRUD ──────────────────────────────────────────────────────

@router.get("/listings", response_model=list[ListingResponse])
async def list_listings(
    listing_type: str | None = None,
    family: str | None = None,
    category: str | None = None,
    condition: str | None = None,
    min_price: int | None = None,
    max_price: int | None = None,
    q: str | None = Query(None),
    sort: str = "newest",  # newest, price_low, price_high
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    query = select(Listing, User.name, User.is_verified)
    query = query.join(User, Listing.seller_id == User.id, isouter=True)
    query = query.where(Listing.status == "active")

    if listing_type:
        query = query.where(Listing.listing_type == listing_type)
    if family:
        query = query.where(Listing.family == family)
    if category:
        query = query.where(Listing.category == category)
    if condition:
        query = query.where(Listing.condition == condition)
    if min_price is not None:
        query = query.where(Listing.price_cents >= min_price)
    if max_price is not None:
        query = query.where(Listing.price_cents <= max_price)
    if q:
        like = f"%{q}%"
        query = query.where(or_(
            Listing.title.ilike(like),
            Listing.description.ilike(like),
            Listing.location.ilike(like),
        ))

    if sort == "price_low":
        query = query.order_by(Listing.price_cents.asc())
    elif sort == "price_high":
        query = query.order_by(Listing.price_cents.desc())
    else:
        query = query.order_by(Listing.created_at.desc())

    query = query.offset(offset).limit(limit)
    result = await db.execute(query)
    rows = result.all()

    return [
        _listing_to_response(lst, name, verified)
        for lst, name, verified in rows
    ]


@router.get("/listings/{listing_id}", response_model=ListingResponse)
async def get_listing(listing_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Listing, User.name, User.is_verified)
        .join(User, Listing.seller_id == User.id, isouter=True)
        .where(Listing.id == listing_id)
    )
    row = result.first()
    if not row:
        raise HTTPException(status_code=404, detail="Listing not found")
    listing, name, verified = row

    # Async view count increment (fire and forget)
    await db.execute(
        Listing.__table__.update().where(Listing.__table__.c.id == listing_id)
        .values(view_count=(listing.view_count or 0) + 1)
    )
    await db.commit()

    return _listing_to_response(listing, name, verified)


@router.post("/listings", response_model=ListingResponse, status_code=201)
async def create_listing(
    body: ListingCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    listing = Listing(
        seller_id=current_user.id,
        listing_type=body.listing_type,
        title=body.title,
        description=body.description,
        family=body.family,
        category=body.category,
        condition=body.condition,
        price_cents=body.price_cents or 0,
        currency=body.currency or "EUR",
        quantity=body.quantity or 1,
        location=body.location,
        lat=body.lat,
        lng=body.lng,
        images=json.dumps(body.images) if body.images else None,
        estimated_waste_diverted_kg=body.estimated_waste_diverted_kg,
        swap_preferences=body.swap_preferences,
    )
    db.add(listing)
    await db.commit()
    await db.refresh(listing)
    return _listing_to_response(listing, current_user.name, current_user.is_verified)


@router.put("/listings/{listing_id}", response_model=ListingResponse)
async def update_listing(
    listing_id: int,
    body: ListingUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Listing).where(Listing.id == listing_id))
    listing = result.scalar_one_or_none()
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    # TECH_DEBT.md §0 (was missing super_admin; was also a bare exact-match
    # on the string "admin") — Phase 3 cutover.
    if listing.seller_id != current_user.id and not rank_at_least(current_user, Rank.admin):
        raise HTTPException(status_code=403, detail="Not authorized")

    for key, val in body.model_dump(exclude_unset=True).items():
        if key == "images" and val is not None:
            val = json.dumps(val)
        setattr(listing, key, val)
    await db.commit()
    await db.refresh(listing)
    return _listing_to_response(listing, current_user.name, current_user.is_verified)


@router.delete("/listings/{listing_id}", status_code=204)
async def delete_listing(
    listing_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Listing).where(Listing.id == listing_id))
    listing = result.scalar_one_or_none()
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    # TECH_DEBT.md §0 (was missing super_admin; was also a bare exact-match
    # on the string "admin") — Phase 3 cutover.
    if listing.seller_id != current_user.id and not rank_at_least(current_user, Rank.admin):
        raise HTTPException(status_code=403, detail="Not authorized")
    listing.status = "removed"
    await db.commit()


# ── My listings & orders ───────────────────────────────────────────────

@router.get("/my/listings", response_model=list[ListingResponse])
async def my_listings(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Listing).where(Listing.seller_id == current_user.id)
        .order_by(Listing.created_at.desc())
    )
    listings = result.scalars().all()
    return [_listing_to_response(lst, current_user.name, current_user.is_verified) for lst in listings]


@router.get("/my/orders", response_model=list[OrderResponse])
async def my_orders(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ListingOrder, Listing.title)
        .join(Listing, ListingOrder.listing_id == Listing.id, isouter=True)
        .where(ListingOrder.buyer_id == current_user.id)
        .order_by(ListingOrder.created_at.desc())
    )
    orders = []
    for order, listing_title in result.all():
        orders.append(OrderResponse(
            id=order.id,
            listing_id=order.listing_id,
            listing_title=listing_title,
            buyer_id=order.buyer_id,
            seller_id=order.seller_id,
            quantity=order.quantity,
            amount_cents=order.amount_cents,
            currency=order.currency,
            payment_status=order.payment_status,
            payment_method=order.payment_method,
            fulfillment_type=order.fulfillment_type,
            fulfillment_status=order.fulfillment_status,
            created_at=order.created_at,
        ))
    return orders


@router.get("/my/sales", response_model=list[OrderResponse])
async def my_sales(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ListingOrder, Listing.title)
        .join(Listing, ListingOrder.listing_id == Listing.id, isouter=True)
        .where(ListingOrder.seller_id == current_user.id)
        .order_by(ListingOrder.created_at.desc())
    )
    sales = []
    for order, listing_title in result.all():
        sales.append(OrderResponse(
            id=order.id,
            listing_id=order.listing_id,
            listing_title=listing_title,
            buyer_id=order.buyer_id,
            seller_id=order.seller_id,
            quantity=order.quantity,
            amount_cents=order.amount_cents,
            currency=order.currency,
            payment_status=order.payment_status,
            payment_method=order.payment_method,
            fulfillment_type=order.fulfillment_type,
            fulfillment_status=order.fulfillment_status,
            created_at=order.created_at,
        ))
    return sales


# ── Seller Stripe onboarding ───────────────────────────────────────────

@router.get("/seller/status", response_model=SellerStatusResponse)
async def seller_status(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(SellerStripeAccount).where(SellerStripeAccount.user_id == current_user.id)
    )
    account = result.scalar_one_or_none()
    if not account:
        return SellerStatusResponse(has_account=False, status="none", details_submitted=False)

    # Sync status from Stripe
    try:
        stripe_info = await stripe_payments.retrieve_account(account.stripe_account_id)
        if stripe_info["details_submitted"] != account.details_submitted:
            account.details_submitted = stripe_info["details_submitted"]
            account.status = "active" if stripe_info["charges_enabled"] else "pending"
            await db.commit()
    except Exception:
        pass

    return SellerStatusResponse(
        has_account=True,
        status=account.status,
        details_submitted=account.details_submitted,
        stripe_account_id=account.stripe_account_id,
    )


@router.post("/seller/onboard")
async def seller_onboard(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(SellerStripeAccount).where(SellerStripeAccount.user_id == current_user.id)
    )
    existing = result.scalar_one_or_none()

    if existing:
        account_id = existing.stripe_account_id
    else:
        account_info = await stripe_payments.create_express_account(
            current_user.id, current_user.email, current_user.name
        )
        account_id = account_info["account_id"]
        new_account = SellerStripeAccount(
            user_id=current_user.id,
            stripe_account_id=account_id,
            status="pending",
        )
        db.add(new_account)
        await db.commit()

    return_url = f"{FRONTEND_URL}/marketplace?onboarding=complete"
    refresh_url = f"{FRONTEND_URL}/marketplace?onboarding=refresh"
    link = await stripe_payments.create_account_link(account_id, return_url, refresh_url)
    return {"url": link}


@router.post("/seller/dashboard-link")
async def seller_dashboard_link(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(SellerStripeAccount).where(SellerStripeAccount.user_id == current_user.id)
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=400, detail="No Stripe account found")
    link = await stripe_payments.create_dashboard_link(account.stripe_account_id)
    return {"url": link}


# ── Purchase / Claim ───────────────────────────────────────────────────

@router.post("/listings/{listing_id}/purchase")
async def purchase_listing(
    listing_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Listing).where(Listing.id == listing_id))
    listing = result.scalar_one_or_none()
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    if listing.status != "active":
        raise HTTPException(status_code=400, detail="Listing is no longer available")
    if listing.seller_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot buy your own listing")
    if listing.listing_type not in ("sell", "offer"):
        raise HTTPException(status_code=400, detail="This listing type cannot be purchased via payment")
    if listing.quantity <= 0:
        raise HTTPException(status_code=400, detail="This item is out of stock")

    # Check seller has Stripe account
    seller_acct_result = await db.execute(
        select(SellerStripeAccount).where(SellerStripeAccount.user_id == listing.seller_id)
    )
    seller_acct = seller_acct_result.scalar_one_or_none()
    seller_stripe_id = seller_acct.stripe_account_id if seller_acct and seller_acct.details_submitted else None

    # Create order
    order = ListingOrder(
        listing_id=listing_id,
        buyer_id=current_user.id,
        seller_id=listing.seller_id,
        quantity=1,
        amount_cents=listing.price_cents,
        currency=listing.currency,
        payment_status="pending",
        payment_method="stripe",
        fulfillment_type="pickup",
    )
    db.add(order)
    # Decrement quantity immediately (restored if payment fails via webhook)
    listing.quantity = max(0, listing.quantity - 1)
    if listing.quantity <= 0:
        listing.status = "sold"
    await db.commit()
    await db.refresh(order)

    # Create Stripe Checkout Session
    success_url = f"{FRONTEND_URL}/marketplace/{listing_id}?order={order.id}&status=success"
    cancel_url = f"{FRONTEND_URL}/marketplace/{listing_id}?order={order.id}&status=cancel"

    try:
        session = await stripe_payments.create_checkout_session(
            amount_cents=listing.price_cents,
            currency=listing.currency,
            listing_title=listing.title,
            listing_id=listing_id,
            order_id=order.id,
            buyer_email=current_user.email,
            seller_stripe_account_id=seller_stripe_id,
            success_url=success_url,
            cancel_url=cancel_url,
        )
    except Exception as e:
        order.payment_status = "failed"
        await db.commit()
        raise HTTPException(status_code=500, detail=f"Payment setup failed: {str(e)}")

    # Store Stripe IDs
    order.stripe_checkout_session_id = session["session_id"]
    order.stripe_payment_intent_id = session.get("payment_intent_id")
    await db.commit()

    return {
        "order_id": order.id,
        "checkout_url": session["checkout_url"],
    }


@router.post("/listings/{listing_id}/claim")
async def claim_listing(
    listing_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Claim a free or swap listing (no payment required)."""
    result = await db.execute(select(Listing).where(Listing.id == listing_id))
    listing = result.scalar_one_or_none()
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    if listing.status != "active":
        raise HTTPException(status_code=400, detail="Listing is no longer available")
    if listing.seller_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot claim your own listing")
    if listing.listing_type not in ("free", "swap"):
        raise HTTPException(status_code=400, detail="Only free and swap listings can be claimed")
    if listing.quantity <= 0:
        raise HTTPException(status_code=400, detail="This item is no longer available")

    order = ListingOrder(
        listing_id=listing_id,
        buyer_id=current_user.id,
        seller_id=listing.seller_id,
        quantity=1,
        amount_cents=0,
        currency=listing.currency,
        payment_status="completed",
        payment_method="free" if listing.listing_type == "free" else "swap",
        fulfillment_type="pickup" if listing.listing_type == "free" else "swap",
    )
    db.add(order)
    listing.quantity = max(0, (listing.quantity or 1) - 1)
    if listing.quantity <= 0:
        listing.status = "sold"
    await db.commit()
    await db.refresh(order)

    return {"order_id": order.id, "status": "completed"}


@router.post("/orders/{order_id}/complete")
async def complete_order(
    order_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Seller marks fulfillment as completed."""
    result = await db.execute(select(ListingOrder).where(ListingOrder.id == order_id))
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.seller_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the seller can complete orders")
    order.fulfillment_status = "completed"
    await db.commit()
    return {"ok": True}


@router.post("/orders/{order_id}/cancel")
async def cancel_order(
    order_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(ListingOrder).where(ListingOrder.id == order_id))
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.buyer_id != current_user.id and order.seller_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    if order.payment_status == "paid":
        raise HTTPException(status_code=400, detail="Cannot cancel a paid order — request a refund instead")
    # Restore quantity if it was decremented
    if order.payment_status == "pending":
        listing_result = await db.execute(select(Listing).where(Listing.id == order.listing_id))
        listing = listing_result.scalar_one_or_none()
        if listing:
            listing.quantity += order.quantity
            if listing.status == "sold":
                listing.status = "active"
    order.fulfillment_status = "cancelled"
    order.payment_status = "failed"
    await db.commit()
    return {"ok": True}
