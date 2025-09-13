-- Add delivery timestamp to order_status table
-- This will track when an order status is changed to 'delivered'

-- Add delivered_at column to order_status table
ALTER TABLE order_status 
ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP WITH TIME ZONE;

-- Create index for better performance on delivery queries
CREATE INDEX IF NOT EXISTS idx_order_status_delivered_at ON order_status(delivered_at);

-- Create function to automatically set delivered_at when status changes to 'delivered'
CREATE OR REPLACE FUNCTION set_delivery_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  -- If status is being changed to 'delivered' and delivered_at is not set
  IF NEW.status = 'delivered' AND OLD.status != 'delivered' AND NEW.delivered_at IS NULL THEN
    NEW.delivered_at = NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically set delivery timestamp
DROP TRIGGER IF EXISTS set_delivery_timestamp_trigger ON order_status;
CREATE TRIGGER set_delivery_timestamp_trigger
  BEFORE UPDATE ON order_status
  FOR EACH ROW
  EXECUTE FUNCTION set_delivery_timestamp();

-- Update existing delivered orders to have delivery timestamp
UPDATE order_status 
SET delivered_at = NOW() 
WHERE status = 'delivered' AND delivered_at IS NULL;

-- Grant necessary permissions
GRANT ALL ON order_status TO authenticated;
GRANT ALL ON order_status TO anon;
