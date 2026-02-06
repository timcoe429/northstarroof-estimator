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
- `waste_percent` (numeric) - Material waste percentage
- `sundries_percent` (numeric) - Materials allowance percentage
- `sundries_amount` (numeric) - Materials allowance amount
- `sales_tax_percent` (numeric) - Sales tax percentage (default 10)
- `sales_tax_amount` (numeric) - Sales tax amount
- `final_price` (numeric) - Final price including sales tax (sell_price + sales_tax_amount)
- `section_headers` (jsonb) - Custom section header names
- `job_description` (text) - Job description text
- `share_token` (text) - Unique token for sharing estimates
- `share_enabled` (boolean) - Whether sharing is enabled
- `total_cost` (numeric)
- `sell_price` (numeric)
- `gross_profit` (numeric)
- `status` (text) - draft/sent/accepted/rejected
- `created_at` (timestamp)
- `updated_at` (timestamp)

## Row Level Security

All tables have RLS enabled. Users can only access their own data.
