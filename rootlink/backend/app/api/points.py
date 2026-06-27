from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.points import PointBalance, PointTransaction
from app.models.user import User
from app.schemas.points import (
    DonationInitiateRequest,
    DonationInitiateResponse,
    PointBalanceResponse,
    PointLeaderboardEntry,
    PointTransactionResponse,
)

router = APIRouter(prefix="/api/points", tags=["points"])


async def _get_or_create_balance(db: AsyncSession, user_id: int) -> PointBalance:
    bal = await db.scalar(select(PointBalance).where(PointBalance.user_id == user_id))
    if not bal:
        bal = PointBalance(user_id=user_id, balance=0.0, total_donated=0.0)
        db.add(bal)
        await db.flush()
    return bal


@router.get("/balance", response_model=PointBalanceResponse)
async def get_balance(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    bal = await _get_or_create_balance(db, current_user.id)
    return PointBalanceResponse(
        balance=bal.balance,
        total_donated=bal.total_donated,
        boost_active=current_user.boost_active,
        boost_expires_at=current_user.boost_expires_at,
        last_decay_at=bal.last_decay_at,
    )


@router.get("/transactions", response_model=list[PointTransactionResponse])
async def get_transactions(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(PointTransaction)
        .where(PointTransaction.user_id == current_user.id)
        .order_by(PointTransaction.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("/donate", response_model=DonationInitiateResponse)
async def initiate_donation(
    body: DonationInitiateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if body.amount_euros < 1:
        raise HTTPException(status_code=400, detail="Minimum donation is 1 EUR")

    if not settings.stripe_secret_key:
        raise HTTPException(status_code=503, detail="Payment system not configured")

    try:
        import stripe
        stripe.api_key = settings.stripe_secret_key

        session = stripe.checkout.Session.create(
            payment_method_types=["card"],
            mode="payment",
            line_items=[{
                "price_data": {
                    "currency": "eur",
                    "product_data": {
                        "name": f"RootLink Community Donation — {body.amount_euros} points",
                        "description": body.tier_name or "Community support donation",
                    },
                    "unit_amount": body.amount_euros * 100,
                },
                "quantity": 1,
            }],
            metadata={"user_id": str(current_user.id), "points": str(body.amount_euros)},
            success_url="https://rootlink.ruisilvastudio.com/donate/success?session_id={CHECKOUT_SESSION_ID}",
            cancel_url="https://rootlink.ruisilvastudio.com/donate/cancel",
        )
        return DonationInitiateResponse(checkout_url=session.url, session_id=session.id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Payment error: {str(e)}")


@router.post("/webhooks/stripe")
async def stripe_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    if not settings.stripe_secret_key:
        raise HTTPException(status_code=503, detail="Payment system not configured")

    try:
        import stripe
        stripe.api_key = settings.stripe_secret_key

        payload = await request.body()
        sig = request.headers.get("stripe-signature", "")

        if settings.stripe_webhook_secret:
            event = stripe.Webhook.construct_event(payload, sig, settings.stripe_webhook_secret)
        else:
            event = stripe.Event.construct_from(stripe.util.json.loads(payload), stripe.api_key)

        if event["type"] != "checkout.session.completed":
            return {"status": "ignored"}

        session = event["data"]["object"]
        user_id = int(session["metadata"]["user_id"])
        points = float(session["metadata"]["points"])

        bal = await _get_or_create_balance(db, user_id)
        bal.balance += points
        bal.total_donated += points

        txn = PointTransaction(
            user_id=user_id,
            amount=points,
            reason="donation",
            reference_id=session["id"],
        )
        db.add(txn)

        user = await db.get(User, user_id)
        if user:
            from app.models.content import Content
            has_published = await db.scalar(
                select(func.count(Content.id)).where(
                    Content.created_by == user_id,
                    Content.status == "published",
                )
            )
            if has_published and has_published > 0:
                user.boost_active = True
                user.boost_expires_at = datetime.now(UTC) + timedelta(days=bal.balance)

        await db.commit()
        return {"status": "ok", "points_credited": points}

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/webhooks/liberapay")
async def liberapay_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    payload = await request.json()

    event_type = payload.get("event_type", "")
    if event_type not in ("payment_received", "subscription_renewed"):
        return {"status": "ignored"}

    participant_id = str(payload.get("participant_id", ""))
    amount = float(payload.get("amount", 0))
    if amount <= 0:
        return {"status": "ignored"}

    result = await db.execute(
        select(User).where(User.feed_verification_token == f"liberapay:{participant_id}")
    )
    user = result.scalar_one_or_none()
    if not user:
        return {"status": "no_matching_user"}

    bal = await _get_or_create_balance(db, user.id)
    bal.balance += amount
    bal.total_donated += amount

    txn = PointTransaction(
        user_id=user.id,
        amount=amount,
        reason="liberapay",
        reference_id=participant_id,
    )
    db.add(txn)

    from app.models.content import Content
    has_published = await db.scalar(
        select(func.count(Content.id)).where(
            Content.created_by == user.id,
            Content.status == "published",
        )
    )
    if has_published and has_published > 0:
        user.boost_active = True
        user.boost_expires_at = datetime.now(UTC) + timedelta(days=bal.balance)

    await db.commit()
    return {"status": "ok", "points_credited": amount}


@router.get("/leaderboard", response_model=list[PointLeaderboardEntry])
async def leaderboard(
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(PointBalance, User.name, User.avatar_url)
        .join(User, User.id == PointBalance.user_id)
        .where(User.visible_in_network.is_(True))
        .order_by(PointBalance.total_donated.desc())
        .limit(limit)
    )
    result = await db.execute(stmt)
    return [
        PointLeaderboardEntry(
            user_id=bal.user_id,
            name=name,
            avatar_url=avatar,
            total_donated=bal.total_donated,
        )
        for bal, name, avatar in result.all()
    ]


@router.get("/tiers")
async def donation_tiers():
    return {
        "tiers": [
            {"name": "Seed", "euros": 5, "points": 5, "description": "Support the community with a small boost"},
            {"name": "Sprout", "euros": 15, "points": 15, "description": "Help your content reach further"},
            {"name": "Grower", "euros": 30, "points": 30, "description": "Sustained community support"},
            {"name": "Cultivator", "euros": 60, "points": 60, "description": "Major contributor to the platform"},
            {"name": "Guardian", "euros": 120, "points": 120, "description": "Pillar of the RootLink community"},
        ],
        "conversion": "1 EUR = 1 point = 1 day of boost",
        "decay": "10% per month when user has published content",
        "platform": "All income supports RootLink as an NGO via donations and Liberapay subscriptions",
    }
