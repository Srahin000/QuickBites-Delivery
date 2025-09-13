-- Create order_history table to store delivered orders
CREATE TABLE IF NOT EXISTS order_history (
  id SERIAL PRIMARY KEY,
  original_order_id INTEGER NOT NULL,
  user_id UUID NOT NULL,
  restaurant_id INTEGER NOT NULL,
  restaurant_name VARCHAR(255) NOT NULL,
  items JSONB NOT NULL,
  total DECIMAL(10,2) NOT NULL,
  order_code VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'delivered',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  delivered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deliverer_id UUID,
  delivery_address TEXT,
  delivery_notes TEXT
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_order_history_user_id ON order_history(user_id);
CREATE INDEX IF NOT EXISTS idx_order_history_delivered_at ON order_history(delivered_at);
CREATE INDEX IF NOT EXISTS idx_order_history_original_order_id ON order_history(original_order_id);

-- Create function to move delivered orders to history
CREATE OR REPLACE FUNCTION move_delivered_order_to_history()
RETURNS TRIGGER AS $$
BEGIN
  -- Only move to history if status is 'delivered'
  IF NEW.status = 'delivered' AND OLD.status != 'delivered' THEN
    -- Insert into order_history
    INSERT INTO order_history (
      original_order_id,
      user_id,
      restaurant_id,
      restaurant_name,
      items,
      total,
      order_code,
      status,
      created_at,
      deliverer_id
    )
    SELECT 
      OLD.id,
      OLD.user_id,
      OLD.restaurant_id,
      OLD.restaurant_name,
      OLD.items,
      OLD.total,
      OLD.order_code,
      NEW.status,
      OLD.created_at,
      OLD.deliverer_id
    FROM orders
    WHERE orders.id = OLD.id;
    
    -- Delete from orders table
    DELETE FROM orders WHERE id = OLD.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically move delivered orders
CREATE TRIGGER move_delivered_orders_trigger
  AFTER UPDATE ON order_status
  FOR EACH ROW
  EXECUTE FUNCTION move_delivered_order_to_history();

-- Grant necessary permissions
GRANT ALL ON order_history TO authenticated;
GRANT ALL ON order_history TO anon;
