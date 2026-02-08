# Database Schema (Supabase)

## Architecture

**Company-Based Ownership**: All business data (price_items, estimates, customers) is owned by companies, not individual users. This prevents data loss when users are deleted or recreated. Users belong to companies and can access all data within their company.

## Tables

### companies
Company information
- `id` (uuid, PK)
- `name` (text) - Company name
- `created_at` (timestamp)
- `updated_at` (timestamp)

### profiles
User settings and preferences
- `id` (uuid, PK) - References auth.users
- `email` (text)
- `company_id` (uuid, FK → companies, NOT NULL) - Company the user belongs to
- `company_name` (text) - Legacy field, kept for compatibility
- `margin_percent` (numeric) - Default profit margin
- `office_percent` (numeric) - Office overhead percentage
- `waste_percent` (numeric) - Material waste percentage
- `anthropic_api_key` (text) - User's own API key (optional)
- `created_at` (timestamp)
- `updated_at` (timestamp)

### price_items
Company's shared price list
- `id` (uuid, PK)
- `company_id` (uuid, FK → companies, NOT NULL) - Company that owns this price item
- `user_id` (uuid, FK → profiles, nullable) - Legacy field, not used for access control
- `name` (text) - Item name
- `category` (text) - materials/labor/equipment/accessories
- `unit` (text) - sq/bundle/lf/each/etc
- `price` (numeric)
- `coverage` (numeric) - Optional coverage amount
- `coverage_unit` (text) - sqft/sq/lf
- `created_at` (timestamp)

### customers
Company's customer information
- `id` (uuid, PK)
- `company_id` (uuid, FK → companies, NOT NULL) - Company that owns this customer
- `user_id` (uuid, FK → profiles, nullable) - Legacy field, not used for access control
- `name` (text)
- `address` (text)
- `phone` (text)
- `email` (text)
- `created_at` (timestamp)

### estimates
Saved estimates
- `id` (uuid, PK)
- `company_id` (uuid, FK → companies, NOT NULL) - Company that owns this estimate
- `user_id` (uuid, FK → profiles, NOT NULL) - User who created the estimate (for audit tracking)
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

### vendor_quotes
Vendor quotes linked to estimates
- `id` (uuid, PK)
- `estimate_id` (uuid, FK → estimates) - Links to estimate (inherits company access)
- `vendor` (text) - Vendor name (schafer, tra, rocky_mountain)
- `quote_number` (text)
- `quote_date` (date)
- `project_address` (text)
- `file_name` (text)
- `subtotal` (numeric)
- `tax` (numeric)
- `total` (numeric)
- `created_at` (timestamp)

### vendor_quote_items
Items from vendor quotes
- `id` (uuid, PK)
- `vendor_quote_id` (uuid, FK → vendor_quotes) - Links to vendor quote (inherits company access)
- `name` (text)
- `unit` (text)
- `price` (numeric)
- `quantity` (numeric)
- `extended_price` (numeric)
- `category` (text)
- `vendor_category` (text)
- `created_at` (timestamp)

## Row Level Security

All tables have RLS enabled. Access control is based on company membership:

- **Company-owned tables** (price_items, estimates, customers): Users can access data if they belong to the same company
- **profiles**: Users can read all profiles in their company, update only their own profile
- **companies**: Users can read their own company
- **vendor_quotes & vendor_quote_items**: Access is controlled through the linked estimate's company_id

**Key Principle**: Business data survives user deletion. Deleting a user does NOT cascade-delete any business data.
