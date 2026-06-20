import logging
from typing import Any

import stripe

from app.core.config import settings

logger = logging.getLogger("app.stripe")

stripe.api_key = settings.stripe_secret_key


async def create_checkout_session(
    amount_cents: int,
    currency: str,
    listing_title: str,
    listing_id: int,
    order_id: int,
    buyer_email: str | None = None,
    seller_stripe_account_id: str | None = None,
    success_url: str = "",
    cancel_url: str = "",
) -> dict[str, str]:
    """Create a Stripe Checkout Session for a marketplace purchase."""
    try:
        params: dict[str, Any] = {
            "payment_method_types": ["card"],
            "line_items": [{
                "price_data": {
                    "currency": currency.lower(),
                    "product_data": {
                        "name": listing_title[:100],
                    },
                    "unit_amount": amount_cents,
                },
                "quantity": 1,
            }],
            "mode": "payment",
            "metadata": {
                "listing_id": str(listing_id),
                "order_id": str(order_id),
            },
            "success_url": success_url,
            "cancel_url": cancel_url,
        }
        if buyer_email:
            params["customer_email"] = buyer_email

        # If seller has a Stripe Connect account, payment goes to them
        kwargs: dict[str, Any] = {}
        if seller_stripe_account_id:
            kwargs["stripe_account"] = seller_stripe_account_id

        session = stripe.checkout.Session.create(**params, **kwargs)
        return {
            "checkout_url": session.url,
            "session_id": session.id,
            "payment_intent_id": session.payment_intent,
        }
    except stripe.error.StripeError as e:
        logger.error(f"Stripe checkout session creation failed: {e}")
        raise


async def create_express_account(user_id: int, email: str, name: str) -> dict[str, str]:
    """Create a Stripe Express account for a seller."""
    try:
        account = stripe.Account.create(
            type="express",
            email=email,
            metadata={"rootlink_user_id": str(user_id), "name": name},
        )
        return {
            "account_id": account.id,
            "status": "pending",
        }
    except stripe.error.StripeError as e:
        logger.error(f"Stripe account creation failed: {e}")
        raise


async def create_account_link(account_id: str, return_url: str, refresh_url: str) -> str:
    """Create an onboarding link for an Express account."""
    try:
        link = stripe.AccountLink.create(
            account=account_id,
            return_url=return_url,
            refresh_url=refresh_url,
            type="account_onboarding",
        )
        return link.url
    except stripe.error.StripeError as e:
        logger.error(f"Stripe account link creation failed: {e}")
        raise


async def create_dashboard_link(account_id: str) -> str:
    """Create a link to the seller's Stripe dashboard."""
    try:
        link = stripe.Account.create_login_link(account_id)
        return link.url
    except stripe.error.StripeError as e:
        logger.error(f"Stripe dashboard link creation failed: {e}")
        raise


async def retrieve_account(account_id: str) -> dict[str, Any]:
    """Retrieve Stripe account status."""
    try:
        account = stripe.Account.retrieve(account_id)
        return {
            "id": account.id,
            "details_submitted": account.details_submitted,
            "charges_enabled": account.charges_enabled,
            "payouts_enabled": account.payouts_enabled,
        }
    except stripe.error.StripeError as e:
        logger.error(f"Stripe account retrieval failed: {e}")
        raise


def verify_webhook_event(payload: bytes, signature: str) -> stripe.Event | None:
    """Verify and construct a Stripe webhook event."""
    if not settings.stripe_webhook_secret:
        logger.warning("STRIPE_WEBHOOK_SECRET not configured — skipping verification")
        return None
    try:
        event = stripe.Webhook.construct_event(
            payload, signature, settings.stripe_webhook_secret
        )
        return event
    except stripe.error.SignatureVerificationError as e:
        logger.error(f"Stripe webhook signature verification failed: {e}")
        return None
    except Exception as e:
        logger.error(f"Stripe webhook construction failed: {e}")
        return None
