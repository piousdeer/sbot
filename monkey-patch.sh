#!/usr/bin/bash

echo Patching discord.js...
find node_modules/discord.js/ -type f -exec sed -i 's/discordapp\.com/discord\.com/g' {} +
sed -i '80s/.*/if (channel != null)/' node_modules/discord.js/src/client/ClientDataManager.js
