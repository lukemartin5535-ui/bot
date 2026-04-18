const { Client, GatewayIntentBits, AttachmentBuilder, EmbedBuilder } = require("discord.js");
const https = require("https");
const http = require("http");
const { URL } = require("url");

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const ROBLOSECURITY = process.env.ROBLOSECURITY;

const ASSET_TYPE_NAMES = {
  1: "Image",
  2: "T-Shirt",
  3: "Audio",
  4: "Mesh",
  5: "Lua Script",
  8: "Hat",
  9: "Place",
  10: "Model",
  11: "Shirt",
  12: "Pants",
  13: "Decal",
  17: "Head",
  18: "Face",
  19: "Gear",
  21: "Badge",
  24: "Animation",
  25: "Torso",
  26: "Right Arm",
  27: "Left Arm",
  28: "Right Leg",
  29: "Left Leg",
  30: "Package",
  31: "Game Pass",
  32: "Plugin",
  38: "Place",
  40: "Mesh Part",
  41: "Hair Accessory",
  42: "Face Accessory",
  43: "Neck Accessory",
  44: "Shoulder Accessory",
  45: "Front Accessory",
  46: "Back Accessory",
  47: "Waist Accessory",
  48: "Climb Animation",
  49: "Death Animation",
  50: "Fall Animation",
  51: "Idle Animation",
  52: "Jump Animation",
  53: "Run Animation",
  54: "Swim Animation",
  55: "Walk Animation",
  56: "Pose Animation",
  61: "Emote Animation",
  62: "Video",
  64: "Tshirt Accessory",
  65: "Shirt Accessory",
  66: "Pants Accessory",
  67: "Jacket Accessory",
  68: "Sweater Accessory",
  69: "Shorts Accessory",
  70: "Left Shoe Accessory",
  71: "Right Shoe Accessory",
  72: "Dress Skirt Accessory",
  73: "Eye Accessory",
  76: "Eyebrow Accessory",
  79: "Dynamic Head",
};

const CLASSIC_CLOTHING_TYPES = new Set([2, 11, 12]);

function extractAssetId(input) {
  input = input.trim();
  if (/^\d+$/.test(input)) return input;
  const match = input.match(/(?:catalog|library|asset)\/(\d+)/);
  if (match) return match[1];
  return null;
}

function fetchUrl(urlStr, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(urlStr);
    const lib = parsed.protocol === "https:" ? https : http;
    const headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      ...extraHeaders,
    };
    if (ROBLOSECURITY) {
      headers["Cookie"] = `.ROBLOSECURITY=${ROBLOSECURITY}`;
    }
    lib.get({ hostname: parsed.hostname, path: parsed.pathname + parsed.search, headers }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchUrl(res.headers.location, extraHeaders).then(resolve).catch(reject);
      }
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () =>
        resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) })
      );
    }).on("error", reject);
  });
}

async function fetchJson(url, extraHeaders = {}) {
  const res = await fetchUrl(url, extraHeaders);
  if (res.status !== 200) throw new Error(`HTTP ${res.status} from ${url}`);
  return JSON.parse(res.body.toString("utf8"));
}

async function getAsset(assetId) {
  // 1. Get asset details
  const details = await fetchJson(
    `https://economy.roblox.com/v2/assets/${assetId}/details`
  );

  const typeId = details.AssetTypeId;
  const typeName = ASSET_TYPE_NAMES[typeId] || `Unknown Type (${typeId})`;
  const creatorName = details.Creator?.Name || "Unknown";
  const itemName = details.Name || `Asset ${assetId}`;

  if (!ROBLOSECURITY) {
    throw new Error("ROBLOSECURITY cookie is not set. See README for instructions.");
  }

  // 2. Fetch the raw asset from Roblox
  const assetRes = await fetchUrl(
    `https://assetdelivery.roblox.com/v1/asset/?id=${assetId}`
  );

  if (assetRes.status !== 200) {
    throw new Error(`Asset delivery returned HTTP ${assetRes.status}. Cookie may be invalid or expired.`);
  }

  const body = assetRes.body;
  const bodyText = body.toString("utf8");

  // 3. Classic clothing: parse XML to get the texture image ID, return PNG
  if (CLASSIC_CLOTHING_TYPES.has(typeId)) {
    let match = bodyText.match(/rbxassetid:\/\/(\d+)/i);
    if (!match) match = bodyText.match(/<url>\s*(\d+)\s*<\/url>/i);
    if (!match) match = bodyText.match(/roblox\.com\/asset\/\?id=(\d+)/i);

    if (!match) {
      throw new Error("Could not find texture ID in clothing asset XML.");
    }

    const imageId = match[1];
    const imgRes = await fetchUrl(`https://assetdelivery.roblox.com/v1/asset/?id=${imageId}`);

    if (imgRes.status !== 200) {
      throw new Error(`Failed to fetch template image (HTTP ${imgRes.status})`);
    }

    return {
      buffer: imgRes.body,
      filename: `template_${assetId}.png`,
      typeName,
      itemName,
      creatorName,
      assetId,
      isModel: false,
    };
  }

  // 4. Everything else: return the raw asset file as .rbxm
  return {
    buffer: body,
    filename: `${itemName.replace(/[^a-zA-Z0-9_\-]/g, "_")}-${assetId}.rbxm`,
    typeName,
    itemName,
    creatorName,
    assetId,
    isModel: true,
  };
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
  if (!ROBLOSECURITY) {
    console.warn("WARNING: ROBLOSECURITY env variable is not set.");
  }
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== "get") return;

  await interaction.deferReply();

  const input = interaction.options.getString("item");
  const assetId = extractAssetId(input);

  if (!assetId) {
    return interaction.editReply(
      "❌ Could not extract an asset ID. Provide a catalog URL or a numeric asset ID."
    );
  }

  try {
    const { buffer, filename, typeName, itemName, creatorName, isModel } = await getAsset(assetId);

    const attachment = new AttachmentBuilder(buffer, { name: filename });

    const embed = new EmbedBuilder()
      .setColor(0xe2231a)
      .setTitle(itemName)
      .setDescription(
        `**Type:** ${typeName}\n**Creator:** ${creatorName}\n**Asset ID:** \`${assetId}\`\n**File:** \`${filename}\``
      )
      .setFooter({ text: "Roblox Asset Fetcher" })
      .setTimestamp();

    // Only show image preview for classic clothing templates
    if (!isModel) {
      embed.setImage(`attachment://${filename}`);
    }

    await interaction.editReply({ embeds: [embed], files: [attachment] });
  } catch (err) {
    console.error(err);
    await interaction.editReply(`❌ ${err.message}`);
  }
});

if (!TOKEN) {
  console.error("Missing DISCORD_TOKEN environment variable.");
  process.exit(1);
}

client.login(TOKEN).then(() => {
  console.log("Bot is online.");
}).catch((err) => {
  console.error("Failed to login:", err.message);
  process.exit(1);
});
