-- QuestKarte expanded marketplace categories
-- Safe to run more than once in Supabase SQL Editor.

insert into public.categories (name, slug, icon, description) values
  ('Cleaning', 'cleaning', 'sparkles', 'Home, room, and property cleaning'),
  ('Home repairs', 'home-repairs', 'hammer', 'Minor repairs, installation, and maintenance'),
  ('Moving help', 'moving-help', 'package', 'Packing, moving, and lifting assistance'),
  ('Delivery', 'delivery', 'bike', 'Pickup and delivery services'),
  ('Errands', 'errands', 'map-pin', 'Everyday personal errands'),
  ('Grocery & shopping', 'grocery-shopping', 'shopping-cart', 'Shopping and item pickup'),
  ('Tutoring', 'tutoring', 'book-open', 'Academic and skills tutoring'),
  ('Academic support', 'academic-support', 'graduation-cap', 'Research, presentation, and study support'),
  ('Design', 'design', 'palette', 'Graphic, brand, and visual design'),
  ('Photography', 'photography', 'camera', 'Photo coverage and editing'),
  ('Video & editing', 'video-editing', 'video', 'Video coverage, editing, and motion work'),
  ('Writing & translation', 'writing-translation', 'pen-line', 'Writing, proofreading, and translation'),
  ('Technology help', 'technology-help', 'monitor', 'Device setup, troubleshooting, and tech support'),
  ('Web & app help', 'web-app-help', 'code-2', 'Website, app, and software assistance'),
  ('Social media', 'social-media', 'share-2', 'Social content and account support'),
  ('Events', 'events', 'calendar-days', 'Event setup, staffing, and coordination'),
  ('Beauty & wellness', 'beauty-wellness', 'heart', 'Personal beauty and wellness services'),
  ('Pet care', 'pet-care', 'paw-print', 'Pet sitting, walking, and care'),
  ('Child care', 'child-care', 'baby', 'Child-minding and family support'),
  ('Elderly support', 'elderly-support', 'hand-heart', 'Non-medical companionship and daily support'),
  ('Gardening', 'gardening', 'sprout', 'Gardening and plant care'),
  ('Vehicle help', 'vehicle-help', 'car', 'Basic vehicle and transport assistance'),
  ('Food & catering', 'food-catering', 'utensils', 'Food preparation and catering'),
  ('Fitness & coaching', 'fitness-coaching', 'dumbbell', 'Fitness, sports, and personal coaching'),
  ('Music & lessons', 'music-lessons', 'music', 'Music support and lessons'),
  ('Other', 'other', 'ellipsis', 'A member-specified task type')
on conflict (slug) do update
  set name = excluded.name,
      icon = excluded.icon,
      description = excluded.description,
      is_active = true;
