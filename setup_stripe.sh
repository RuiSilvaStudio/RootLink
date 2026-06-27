#!/bin/bash
# setup_stripe.sh - Add Stripe keys to production server
# Usage: ./setup_stripe.sh

set -e

echo "=== Stripe Configuration Setup ==="
echo ""
echo "You will need:"
echo "1. Stripe Secret Key (sk_test_...)"
echo "2. Stripe Publishable Key (pk_test_...)"
echo "3. Stripe Webhook Secret (whsec_...)"
echo ""
echo "Get these from: https://dashboard.stripe.com/test/apikeys"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "Creating .env file..."
    cat > .env << 'EOF'
# Production environment variables
SECRET_KEY=change-me-in-production
CORS_ORIGINS=http://localhost:3000,http://localhost:3001,https://rootlink.ruisilvastudio.com
MEDIA_URL=https://api.ruisilvastudio.com

# Stripe (test mode)
STRIPE_SECRET_KEY=sk_test_placeholder
STRIPE_PUBLISHABLE_KEY=pk_test_placeholder
STRIPE_WEBHOOK_SECRET=whsec_placeholder

# Liberapay (optional, for later)
LIBERAPAY_WEBHOOK_SECRET=
EOF
    echo "✅ Created .env file with placeholders"
fi

echo ""
echo "Current Stripe configuration:"
grep "STRIPE_" .env | sed 's/=.*/=***/'

echo ""
read -p "Do you want to update Stripe keys now? (y/n): " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    read -p "Enter Stripe Secret Key (sk_test_...): " SECRET_KEY
    read -p "Enter Stripe Publishable Key (pk_test_...): " PUB_KEY
    
    # Update .env file
    sed -i "s|STRIPE_SECRET_KEY=.*|STRIPE_SECRET_KEY=$SECRET_KEY|" .env
    sed -i "s|STRIPE_PUBLISHABLE_KEY=.*|STRIPE_PUBLISHABLE_KEY=$PUB_KEY|" .env
    
    echo ""
    echo "✅ Stripe keys updated in .env"
    echo ""
    echo "Next steps:"
    echo "1. Restart Docker containers: docker compose -f docker-compose.prod.yml up -d"
    echo "2. Set up webhook (see DEPLOY.md)"
    echo "3. Test donation at: https://rootlink.ruisilvastudio.com/donate"
else
    echo "Skipping key update"
fi
