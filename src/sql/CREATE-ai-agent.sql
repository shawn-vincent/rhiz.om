INSERT INTO "rhiz.om_being" (id, name, type, "ownerId", "locationId")
VALUES (
    '@rhiz.om-assistant',
    'Rhiz.om Assistant',
    'bot',                -- it is a bot
    '@rhiz.om-assistant', -- The agent can own itself
    '@intraliminal'      -- Place it in the default space, or a system space
);