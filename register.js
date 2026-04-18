// Run this ONCE to register slash commands:
//   node register.js
//
// You only need to re-run this if you add or change commands.

const { SlashCommandBuilder, REST, Routes } = require("discord.js");

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;

if (!TOKEN || !CLIENT_ID) {
  console.error("Set DISCORD_TOKEN and DISCORD_CLIENT_ID environment variables first.");
  process.exit(1);
}

const commands = [
  new SlashCommandBuilder()
    .setName("get")
    .setDescription("Fetch the 2D template of a Roblox clothing item")
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
    console.log("Registering slash commands with Discord...");
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log("✅ Done! Slash commands registered globally.");
    console.log("Note: Global commands can take up to 1 hour to appear in Discord.");
    console.log("For instant testing, use registerGuild.js with a guild ID instead.");
  } catch (err) {
    console.error("❌ Failed:", err.message);
    process.exit(1);
  }
})();
