
INSERT INTO public.store_settings (store_name, tagline, open_time, close_time, whatsapp_number, upi_id, upi_name, delivery_fee, free_delivery_over, min_order_value, delivery_radius_km, store_address, store_lat, store_lng, is_open, announcement, primary_color, accent_color, gst_enabled, gst_percent, footer_about, contact_email, contact_phone, address_line, serviceable_pincodes)
VALUES ('Fish N Fresh', 'Fresh from the harbour, daily', '06:00', '21:00', '919876543210', 'fishnfresh@upi', 'Fish N Fresh', 40, 499, 199, 12, 'Harbour Road, Chennai', 13.0827, 80.2707, true, 'Free delivery on orders above Rs.499', '#0c6ca8', '#15b3a0', true, 5, 'Fish N Fresh delivers fresh, lab-tested seafood sourced daily from local harbours.', 'hello@fishnfresh.in', '+91 98765 43210', 'Harbour Road, Chennai 600001', ARRAY['600001','600002','600003','600004']);

INSERT INTO public.categories (name, slug, image_url, icon, sort_order) VALUES
('Sea Fish','sea-fish','https://images.unsplash.com/photo-1544943910-4c1dc44aab44?w=600','fish',1),
('River Fish','river-fish','https://images.unsplash.com/photo-1498654200943-1088dd4438ae?w=600','fish',2),
('Prawns','prawns','https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?w=600','shell',3),
('Crabs','crabs','https://images.unsplash.com/photo-1559737558-2f5a35f4523b?w=600','shell',4),
('Squid & Shellfish','squid','https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=600','waves',5),
('Dried Fish','dried-fish','https://images.unsplash.com/photo-1580476262798-bddd9f4b7369?w=600','sun',6);

INSERT INTO public.branches (name, address, phone, manager, lat, lng, open_time, close_time, delivery_radius_km, is_active, sort_order) VALUES
('Chennai Harbour','Harbour Road, Chennai 600001','+91 98765 43210','Ravi Kumar',13.0827,80.2707,'06:00','21:00',12,true,1),
('Velachery','100 Feet Road, Velachery 600042','+91 98765 43211','Suresh M',12.9791,80.2209,'07:00','21:00',10,true,2);

INSERT INTO public.products (name, name_tamil, description, price, old_price, unit, category, image_url, stock, is_available, origin, rating, is_featured, tags, calories, protein, best_for, benefits, storage, source_origin, lab_tested, traceability) VALUES
('Seer Fish (Vanjaram)','வஞ்சரம்','Premium steak-cut seer fish, firm and boneless.',1200,1400,'kg','Sea Fish','https://images.unsplash.com/photo-1611171711791-b34fa42e9fc4?w=800',25,true,'Bay of Bengal',4.8,true,ARRAY['bestseller','premium'],120,'22g','Fry, Curry',ARRAY['Omega-3 rich','Low fat'],'Keep frozen at -18C','Chennai Harbour',true,'Caught by FV Meenakshi, iced within 2 hours'),
('Indian Salmon (Kaala)','காளா','Soft textured, ideal for gravies.',780,880,'kg','Sea Fish','https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=800',30,true,'Bay of Bengal',4.5,true,ARRAY['popular'],118,'20g','Curry',ARRAY['High protein'],'Keep chilled','Chennai Harbour',true,'Harbour landed same day'),
('Pomfret White','வவ்வால்','Delicate white pomfret, whole cleaned.',1100,NULL,'kg','Sea Fish','https://images.unsplash.com/photo-1535140728325-a4d3707eee61?w=800',15,true,'Arabian Sea',4.7,true,ARRAY['premium'],96,'19g','Fry, Grill',ARRAY['Low calorie'],'Keep frozen','Kochi',true,'Cold chain verified'),
('Sardine (Mathi)','மத்தி','Everyday favourite, cleaned and cut.',180,220,'kg','Sea Fish','https://images.unsplash.com/photo-1544943910-4c1dc44aab44?w=800',60,true,'Bay of Bengal',4.3,false,ARRAY['budget'],208,'25g','Fry',ARRAY['Omega-3 rich','Budget friendly'],'Consume same day','Chennai Harbour',true,'Morning catch'),
('Mackerel (Ayla)','அயிலை','Rich flavour, perfect for tawa fry.',280,320,'kg','Sea Fish','https://images.unsplash.com/photo-1498654200943-1088dd4438ae?w=800',45,true,'Bay of Bengal',4.4,false,ARRAY['bestseller'],205,'24g','Fry, Curry',ARRAY['Vitamin D'],'Keep chilled','Chennai Harbour',true,'Landed 6 AM'),
('Tilapia','ஜிலேபி கெண்டை','Fresh water tilapia, cleaned.',260,NULL,'kg','River Fish','https://images.unsplash.com/photo-1510130387422-82bed34b37e9?w=800',40,true,'Local Farm',4.1,false,ARRAY['budget'],128,'26g','Curry',ARRAY['Lean protein'],'Keep chilled','Kolli Farms',true,'Farm to store in 6 hours'),
('Rohu (Kendai)','கெண்டை','Popular river fish, curry cut.',300,340,'kg','River Fish','https://images.unsplash.com/photo-1524704654690-b56c05c78a00?w=800',35,true,'Andhra',4.2,false,ARRAY['popular'],97,'17g','Curry',ARRAY['Rich in calcium'],'Keep chilled','Andhra Farms',true,'Live transport'),
('Katla','கட்லா','Large river fish, thick cut steaks.',320,NULL,'kg','River Fish','https://images.unsplash.com/photo-1466637574441-749b8f19452f?w=800',20,true,'Andhra',4.0,false,ARRAY[]::text[],111,'19g','Curry',ARRAY['High protein'],'Keep chilled','Andhra Farms',true,'Farm certified'),
('Tiger Prawns Large','இறால்','Jumbo tiger prawns, deveined.',900,1050,'kg','Prawns','https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?w=800',22,true,'Bay of Bengal',4.9,true,ARRAY['bestseller','premium'],99,'24g','Grill, Roast',ARRAY['Low fat','High protein'],'Keep frozen','Nagapattinam',true,'Traceable pond batch #P-224'),
('White Prawns Medium','வெள்ளை இறால்','Cleaned medium prawns.',620,700,'kg','Prawns','https://images.unsplash.com/photo-1625943553852-781c6dd46faa?w=800',28,true,'Bay of Bengal',4.5,false,ARRAY['popular'],85,'20g','Fry, Curry',ARRAY['Rich in selenium'],'Keep frozen','Nagapattinam',true,'Pond batch #P-231'),
('Mud Crab Large','நண்டு','Live-caught mud crab, cleaned.',850,950,'kg','Crabs','https://images.unsplash.com/photo-1559737558-2f5a35f4523b?w=800',12,true,'Pichavaram',4.6,true,ARRAY['premium'],97,'19g','Masala, Roast',ARRAY['Zinc rich'],'Cook fresh','Pichavaram',true,'Backwater caught'),
('Blue Swimmer Crab','சிறு நண்டு','Sweet meat, medium size.',520,NULL,'kg','Crabs','https://images.unsplash.com/photo-1587202372775-e229f172b9d7?w=800',18,true,'Bay of Bengal',4.2,false,ARRAY[]::text[],87,'18g','Curry',ARRAY['Low fat'],'Cook fresh','Chennai Harbour',true,'Day catch'),
('Squid Rings','கணவாய்','Cleaned squid tubes and rings.',480,540,'kg','Squid & Shellfish','https://images.unsplash.com/photo-1615141982883-c7ad0e69fd62?w=800',24,true,'Bay of Bengal',4.3,false,ARRAY['popular'],92,'16g','Fry',ARRAY['Low calorie'],'Keep frozen','Chennai Harbour',true,'Flash frozen'),
('Dried Anchovy (Nethili Karuvadu)','நெத்திலி கருவாடு','Sun dried anchovy, cleaned.',450,NULL,'250g','Dried Fish','https://images.unsplash.com/photo-1580476262798-bddd9f4b7369?w=800',50,true,'Rameswaram',4.4,false,ARRAY['traditional'],300,'40g','Chutney, Fry',ARRAY['Calcium rich'],'Store in airtight jar','Rameswaram',true,'Sun dried, no chemicals');

INSERT INTO public.promotions (name, type, code, discount_type, value, min_order, active, description, one_time_per_customer) VALUES
('Welcome Offer','coupon','WELCOME10','percent',10,299,true,'10% off on your first order above Rs.299',true),
('Friday Fish Fest','special_day',NULL,'percent',15,499,true,'15% off every Friday on orders above Rs.499',false),
('Flat 100 Off','coupon','FRESH100','fixed',100,799,true,'Flat Rs.100 off on orders above Rs.799',false);

INSERT INTO public.banners (title, subtitle, image_url, link, cta, active, sort_order) VALUES
('Fresh Catch Daily','Straight from the harbour to your kitchen','https://images.unsplash.com/photo-1534043464124-3be32fe000c9?w=1400','/catalog','Shop now',true,1),
('Jumbo Tiger Prawns','Now at 15% off this week','https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?w=1400','/catalog?category=Prawns','Grab deal',true,2),
('Free Delivery','On every order above Rs.499','https://images.unsplash.com/photo-1498654200943-1088dd4438ae?w=1400','/catalog','Order now',true,3);
