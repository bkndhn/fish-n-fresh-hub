CREATE OR REPLACE VIEW public.store_settings_public
WITH (security_invoker = on) AS
SELECT id, store_name, tagline, shop_logo, open_time, close_time, lunch_start, lunch_end,
  block_during_lunch, weekly_holidays, holidays, holiday_dates, block_on_holidays, whatsapp_number,
  upi_name, delivery_fee, free_delivery_over, min_order_value, delivery_radius_km,
  additional_charge_label, additional_charge_value, delivery_enabled, pickup_enabled, cod_enabled,
  online_enabled, store_address, store_lat, store_lng, is_open, announcement, low_stock_threshold,
  primary_color, accent_color, gst_enabled, gst_percent, footer_about, contact_email, contact_phone,
  support_whatsapp, address_line, facebook_url, instagram_url, twitter_url, terms_content,
  privacy_content, refund_content, home_show_banner, home_show_hero, home_show_trust,
  home_show_categories, home_show_bestsellers, home_show_featured, home_show_allproducts,
  serviceable_pincodes, created_at, updated_at, shop_lat, shop_lng, base_delivery_fee, per_km_charge,
  max_delivery_radius_km, complaint_window_hours, logo_url, support_phone, support_email,
  social_whatsapp, social_instagram, social_facebook, social_x, terms_and_conditions, theme_color,
  google_review_link, require_online_payment, working_days, custom_holidays,
  allow_preorders_when_closed, closed_message, default_gst_percent, show_stock_to_customers,
  stock_urgency_threshold, express_delivery_enabled, express_delivery_fee, express_sla_mins,
  wallet_enabled, referral_reward_referrer, referral_reward_referee, cashback_percent,
  max_wallet_burn_percent, business_vertical, vertical_tagline, vertical_banner_url,
  vertical_badge_text, live_alerts_enabled, harbour_source_name, harbour_alert_title,
  harbour_alert_message, printer_paper_width, printer_auto_cut, printer_open_drawer,
  printer_header_line1, printer_header_line2, printer_footer_text, feature_pos_enabled,
  feature_wallet_enabled, feature_route_optimization_enabled, feature_live_chat_enabled,
  feature_ai_benefits_enabled, feature_fcm_enabled, email_notifications_enabled, seo_title_template,
  seo_default_description, seo_keywords, seo_og_image, ga4_measurement_id, meta_pixel_id, sender_name,
  notification_sound_enabled, referral_program_enabled, firm_name, free_delivery_threshold,
  daily_atmosphere_enabled, ordering_mode, whatsapp_order_phone, printer_show_gstin,
  printer_show_fssai, printer_show_address, printer_show_phone, printer_show_whatsapp,
  printer_show_social, printer_show_support, printer_show_return_policy,
  printer_custom_footer_message, printer_whatsapp_number, printer_social_handle, default_language,
  wholesale_min_order_value, sales_mode
FROM public.store_settings;

GRANT SELECT ON public.store_settings_public TO anon, authenticated;
GRANT ALL ON public.store_settings_public TO service_role;