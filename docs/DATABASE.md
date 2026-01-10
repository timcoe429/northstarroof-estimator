# Database Schema (Supabase)

## Tables

### profiles
User settings and preferences
- `id` (uuid, PK) - References auth.users
- `email` (text)
- `company_name` (text)
- `margin_percent` (numeric) - Default profit margin
- `office_percent` (numeric) - Office overhead percentage
- `waste_percent` (numeric) - Material waste percentage
- `anthropic_api_key` (text) - User's own API key (optional)
- `created_at` (timestamp)
- `updated_at` (timestamp)

### price_items
User's saved price list
- `id` (uuid, PK)
- `user_id` (uuid, FK → profiles)
- `name` (text) - Item name
- `category` (text) - materials/labor/equipment/accessories
- `unit` (text) - sq/bundle/lf/each/etc
- `price` (numeric)
- `coverage` (numeric) - Optional coverage amount
- `coverage_unit` (text) - sqft/sq/lf
- `created_at` (timestamp)

### customers
Customer information
- `id` (uuid, PK)
- `user_id` (uuid, FK → profiles)
- `name` (text)
- `address` (text)
- `phone` (text)
- `email` (text)
- `created_at` (timestamp)

### estimates
Saved estimates
- `id` (uuid, PK)
- `user_id` (uuid, FK → profiles)
- `customer_id` (uuid, FK → customers)
- `name` (text)
- `measurements` (jsonb) - Roof measurements
- `line_items` (jsonb) - Selected items with quantities
- `base_cost` (numeric)
- `office_percent` (numeric)
- `office_amount` (numeric)
- `margin_percent` (numeric)
- `total_cost` (numeric)
- `sell_price` (numeric)
- `gross_profit` (numeric)
- `status` (text) - draft/sent/accepted/rejected
- `created_at` (timestamp)
- `updated_at` (timestamp)

## Row Level Security

All tables have RLS enabled. Users can only access their own data.
