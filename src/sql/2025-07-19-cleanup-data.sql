delete from "rhiz.om_being" where "id" in (
  '7dc399c7-3e90-48d0-9ae0-123da8008baa',
  '@intraliminial'
);

select * from "rhiz.om_being";

update "rhiz.om_being" set "ownerId" = 'b5a7e54e-2a25-4f5b-bb11-ad1f7b039201' where "id" in (
  'b5a7e54e-2a25-4f5b-bb11-ad1f7b039201'
);

update "rhiz.om_being" set "locationId" = '@intraliminal' where "id" in (
  'b5a7e54e-2a25-4f5b-bb11-ad1f7b039201'
);

update "rhiz.om_being" set "type" = 'guest' where "id" in (
  'b5a7e54e-2a25-4f5b-bb11-ad1f7b039201'
);