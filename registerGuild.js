// Register commands to a specific server for INSTANT availability (no 1hr wait).
// Run once:
//   node registerGuild.js YOUR_SERVER_ID
//
// To find your server ID: Enable Developer Mode in Discord settings,
// then right-click your server icon → Copy Server ID.

const { SlashCommandBuilder, REST, Routes } = require("discord.js");

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const GUILD_ID = process.argv[2];

if (!TOKEN || !CLIENT_ID) {
  console.error("Set DISCORD_TOKEN and DISCORD_CLIENT_ID environment variables first.");
  process.exit(1);
}
if (!GUILD_ID) {
  console.error("Usage: node registerGuild.js YOUR_SERVER_ID");
  process.exit(1);
}

const commands = [
  new SlashCommandBuilder()
    .setName("asset")
    .setDescription("Fetch the template or model file of any Roblox asset")
    .addStringOption((opt) =>
      opt
        .setName("item")
        .setDescription("Roblox catalog URL or asset ID")
        .setRequired(true)
    )
    .toJSON(),
];

const rest = new REST({ version: "10" }).setToken(TOKEN);

(async () => {
  try {
    console.log(`Registering commands in guild ${GUILD_ID}...`);
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
    console.log("✅ Done! Commands are instantly available in your server.");
  } catch (err) {
    console.error("❌ Failed:", err.message);
    process.exit(1);
  }
})();
