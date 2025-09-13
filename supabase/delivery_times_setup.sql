-- Create delivery_times table
CREATE TABLE IF NOT EXISTS delivery_times (
  id SERIAL PRIMARY KEY,
  day VARCHAR(20) NOT NULL,
  time TIME NOT NULL,
  counter INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_delivery_times_day ON delivery_times(day);
CREATE INDEX IF NOT EXISTS idx_delivery_times_day_time ON delivery_times(day, time);

-- Insert sample data for Monday (for testing)
INSERT INTO delivery_times (day, time, counter) VALUES
('Monday', '9:00 AM', 0),
('Monday', '10:00 AM', 0),
('Monday', '11:00 AM', 0),
('Monday', '12:00 PM', 0),
('Monday', '1:00 PM', 0),
('Monday', '2:00 PM', 0),
('Monday', '3:00 PM', 0),
('Monday', '4:00 PM', 0),
('Monday', '5:00 PM', 0),
('Monday', '6:00 PM', 0),
('Monday', '7:00 PM', 0),
('Monday', '8:00 PM', 0)
ON CONFLICT DO NOTHING;

-- Insert sample data for other days (for future use)
INSERT INTO delivery_times (day, time, counter) VALUES
('Tuesday', '9:00 AM', 0),
('Tuesday', '10:00 AM', 0),
('Tuesday', '11:00 AM', 0),
('Tuesday', '12:00 PM', 0),
('Tuesday', '1:00 PM', 0),
('Tuesday', '2:00 PM', 0),
('Tuesday', '3:00 PM', 0),
('Tuesday', '4:00 PM', 0),
('Tuesday', '5:00 PM', 0),
('Tuesday', '6:00 PM', 0),
('Tuesday', '7:00 PM', 0),
('Tuesday', '8:00 PM', 0),
('Wednesday', '9:00 AM', 0),
('Wednesday', '10:00 AM', 0),
('Wednesday', '11:00 AM', 0),
('Wednesday', '12:00 PM', 0),
('Wednesday', '1:00 PM', 0),
('Wednesday', '2:00 PM', 0),
('Wednesday', '3:00 PM', 0),
('Wednesday', '4:00 PM', 0),
('Wednesday', '5:00 PM', 0),
('Wednesday', '6:00 PM', 0),
('Wednesday', '7:00 PM', 0),
('Wednesday', '8:00 PM', 0),
('Thursday', '9:00 AM', 0),
('Thursday', '10:00 AM', 0),
('Thursday', '11:00 AM', 0),
('Thursday', '12:00 PM', 0),
('Thursday', '1:00 PM', 0),
('Thursday', '2:00 PM', 0),
('Thursday', '3:00 PM', 0),
('Thursday', '4:00 PM', 0),
('Thursday', '5:00 PM', 0),
('Thursday', '6:00 PM', 0),
('Thursday', '7:00 PM', 0),
('Thursday', '8:00 PM', 0),
('Friday', '9:00 AM', 0),
('Friday', '10:00 AM', 0),
('Friday', '11:00 AM', 0),
('Friday', '12:00 PM', 0),
('Friday', '1:00 PM', 0),
('Friday', '2:00 PM', 0),
('Friday', '3:00 PM', 0),
('Friday', '4:00 PM', 0),
('Friday', '5:00 PM', 0),
('Friday', '6:00 PM', 0),
('Friday', '7:00 PM', 0),
('Friday', '8:00 PM', 0),
('Saturday', '9:00 AM', 0),
('Saturday', '10:00 AM', 0),
('Saturday', '11:00 AM', 0),
('Saturday', '12:00 PM', 0),
('Saturday', '1:00 PM', 0),
('Saturday', '2:00 PM', 0),
('Saturday', '3:00 PM', 0),
('Saturday', '4:00 PM', 0),
('Saturday', '5:00 PM', 0),
('Saturday', '6:00 PM', 0),
('Saturday', '7:00 PM', 0),
('Saturday', '8:00 PM', 0),
('Sunday', '9:00 AM', 0),
('Sunday', '10:00 AM', 0),
('Sunday', '11:00 AM', 0),
('Sunday', '12:00 PM', 0),
('Sunday', '1:00 PM', 0),
('Sunday', '2:00 PM', 0),
('Sunday', '3:00 PM', 0),
('Sunday', '4:00 PM', 0),
('Sunday', '5:00 PM', 0),
('Sunday', '6:00 PM', 0),
('Sunday', '7:00 PM', 0),
('Sunday', '8:00 PM', 0)
ON CONFLICT DO NOTHING;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_delivery_times_updated_at 
    BEFORE UPDATE ON delivery_times 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Grant necessary permissions (adjust as needed for your setup)
-- GRANT SELECT, INSERT, UPDATE ON delivery_times TO authenticated;
-- GRANT USAGE ON SEQUENCE delivery_times_id_seq TO authenticated;
