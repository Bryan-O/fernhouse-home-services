-- A booking is 'pending' from checkout start until payment (or card save) succeeds.
-- Its slot is held for 15 minutes (slot_holds); after that it no longer counts against capacity.
alter type plan_status add value if not exists 'pending' before 'active';
