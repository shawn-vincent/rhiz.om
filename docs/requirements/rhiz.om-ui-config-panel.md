## Config Panel

Allows configuration of any properties of the currently focused entity in a nice form using standard UI widgets.  

Form should be dynanmically generated based on properties of @being object that constitutes the space.  Go through the properties in the Zod being schema, and build form elements using the chosen UI library that can edit and validate according to the Zod schema.  Use uniforms-bridge-zod (v4.0.0 as of Jul 13 2025)

Saving the config panel should modify the being - posting to an appropriate /api endpoint, which would go through the normal sync to update the client.

Only owner or SUPERUSER (special property can be set on @beings) can see and edit the properties.

