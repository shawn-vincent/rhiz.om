INSERT INTO "rhiz.om_being" (id, name, type, "ownerId", "locationId")
VALUES (
    '@rhiz.om-assistant',
    'Rhiz.om Assistant',
    'guest',            -- Using 'guest' or a new 'ai_agent' type
    '@rhiz.om-assistant', -- The agent can own itself
    '@intraliminal'      -- Place it in the default space, or a system space
);