const Discord = require("discord.js");
const config = require("../config.json");
const categoria = require("../categoria.json");
const { QuickDB } = require("quick.db");
const fs = require("fs");
const assumedFilePath = "assumed.json";
const db = new QuickDB();
const db2 = new QuickDB({ table: "assum" });
const languages = require("../translation/languages-assum.json");

function readAssumedData() {
  try {
    const data = fs.readFileSync(assumedFilePath, "utf8");
    return JSON.parse(data);
  } catch (err) {
    return {};
  }
}

function saveAssumedData(data) {
  fs.writeFileSync(assumedFilePath, JSON.stringify(data, null, 4), "utf8");
}

module.exports = {
  name: "ticket",
  async execute(interaction, message) {
    if (interaction.isButton() && interaction.customId === "assumir_ticket") {
      const ticket = await db.get(`ticket_${interaction.channel.id}`);
      const user = await interaction.guild.members.cache.get(ticket.owner_id);
      const select = ticket.selected;
      const title = ticket.title;
      const randomToken = ticket.aaaaa;

      const language = ticket.language || "en";
      const lang = languages[language];

      const user1 = interaction.guild.members.cache.get(interaction.user.id);
      const roleIdToCheck = config.cargo_staff;

      const hasRequiredRole = roleIdToCheck.some(roleID => user1.roles.cache.has(roleID));

      if (!hasRequiredRole) {
        await interaction.reply({ 
          content: lang.noPermission, 
          ephemeral: true 
        });
        return;
      }

      const staffUserId = interaction.user.id;
      const assumedData = readAssumedData();

      if (!assumedData[staffUserId]) {
        assumedData[staffUserId] = 0;
      }

      assumedData[staffUserId]++;
      saveAssumedData(assumedData);

      await db.set(`ticket_${interaction.channel.id}`, {
        owner_id: user.id,
        title: title,
        selected: select,
        aaaaa: randomToken,
        assumed: interaction.user.id,
        language: language,
      });

      await db2.set(`avalia_${user.id}`, {
        assumiu: interaction.user.id,
      });

      user.send({
        embeds: [
          new Discord.EmbedBuilder().setDescription(
            lang.staffTookOverTicket
              .replace("{0}", user)
              .replace("{1}", interaction.user)
              .replace("{2}", interaction.channel.url)
          ),
        ],
        components: [
          new Discord.ActionRowBuilder().addComponents(
            new Discord.ButtonBuilder()
              .setLabel(lang.goToTicket)
              .setStyle(Discord.ButtonStyle.Link)
              .setURL(interaction.channel.url)
          ),
        ],
      });

      interaction.update({
        embeds: [
          new Discord.EmbedBuilder()
            .setAuthor({
              name: `${interaction.guild.name}`,
              iconURL: interaction.guild.iconURL({ dynamic: true }),
            })
            .setDescription(
              `${lang.ticketRecoveryCode.replace("{0}", randomToken)}\n\n${lang.verifyTopic}\n${lang.ticketType.replace("{0}", select)}\n${lang.ticketReason.replace("{0}", title)}\n\n${lang.staffTookOver.replace("{0}", interaction.user)}`
            ),
        ],
        components: [
          new Discord.ActionRowBuilder().addComponents(
            new Discord.ButtonBuilder()
              .setCustomId("sair_ticket")
              .setLabel(lang.leaveSupport)
              .setStyle(Discord.ButtonStyle.Primary),
            new Discord.ButtonBuilder()
              .setCustomId("painel_ticket")
              .setLabel(lang.staffPanel)
              .setEmoji("<a:staff:1117544206274154556>")
              .setStyle(Discord.ButtonStyle.Secondary),
            new Discord.ButtonBuilder()
              .setCustomId("assumir_ticket")
              .setLabel(lang.ticketTaken)
              .setDisabled(true)
              .setEmoji("<a:staff:1117544206274154556>")
              .setStyle(Discord.ButtonStyle.Secondary),
            new Discord.ButtonBuilder()
              .setCustomId("fechar_ticket")
              .setLabel(lang.closeTicket)
              .setEmoji("❌")
              .setStyle(Discord.ButtonStyle.Danger)
          ),
        ],
      });
    }
  },
};