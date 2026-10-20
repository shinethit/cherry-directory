-- Fuel Stations from OSM
-- Run in Supabase SQL Editor

INSERT INTO fuel_stations (name, township, latitude, longitude, address) VALUES
('Nila Yoma', 'Taunggyi', 20.7622043, 97.0481452, 'အရှေ့ပတ်လမ်းမ East Circular Rd'),
('103 Station', 'Taunggyi', 20.7530258, 97.0632626, ''),
('TBG Station', 'Taunggyi', 20.7573589, 97.0591977, ''),
('Petrol Station', 'Taunggyi', 20.7465272, 97.0803827, ''),
('Tiger Station', 'Taunggyi', 20.7920465, 97.0089301, ''),
('Petrol Station', 'Taunggyi', 20.7528394, 97.0636271, ''),
('Petrol Station', 'Taunggyi', 20.7554176, 97.0602159, ''),
('TOP LINE Station', 'Taunggyi', 20.7557932, 97.0599871, ''),
('Excellent Power Station', 'Taunggyi', 20.7582444, 97.0588538, ''),
('KYAW SAN Station', 'Taunggyi', 20.7512626, 97.0662066, ''),
('Nilar Yoma Station', 'Taunggyi', 20.7621415, 97.048528, ''),
('Petrol Station', 'Taunggyi', 20.7532073, 97.062892, ''),
('Excellent Power Station', 'Taunggyi', 20.7916263, 97.0085135, ''),
('Excellent Power Station', 'Taunggyi', 20.7919097, 97.0084156, ''),
('Petrol Station', 'Taunggyi', 20.7526963, 97.0639293, ''),
('Petrol Station', 'Taunggyi', 20.7519768, 97.0650261, ''),
('Petrol Station', 'Taunggyi', 20.7867536, 97.0362091, ''),
('Nwe Waddy Kaw Station', 'Taunggyi', 20.7921377, 97.0108748, ''),
('BOC', 'Taunggyi', 20.7988557, 97.036781, ''),
('Phyu Zin Co,Ltd.', 'Taunggyi', 20.752585, 97.064366, 'hopone-tgi road'),
('ASIA POWER', 'Taunggyi', 20.7910567, 97.0401012, 'E Circular Rd'),
('Unknown Fuel Station', 'Taunggyi', 20.7926438, 97.0123118, ''),
('၁၀၃ စက်သုံးဆီရောင်းဝယ်ရေး', 'Taunggyi', 20.789422, 97.0384983, 'သီတာလမ်း');

INSERT INTO markets (name, city) VALUES
('မြို့မဈေး', 'Taunggyi'),
('အမှတ် (၅) ဈေး', 'Taunggyi'),
('ၵၢတ်ႇၸဝ်ႈၸၢမ်ႇထုၼ်း', 'Taunggyi') ON CONFLICT (name) DO NOTHING;
