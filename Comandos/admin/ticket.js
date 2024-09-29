const Discord = require("discord.js");
const userLanguages = require("../../translation/languages-comm.json");
const { QuickDB } = require("quick.db");
const db = new QuickDB();

module.exports = {
    name: "panel",
    description: "[ 🎫 ] Send ticket panel.",
    type: Discord.ApplicationCommandType.ChatInput,
    options: [
        {
            name: "language",
            description: "Choose the ticket language.",
            type: Discord.ApplicationCommandOptionType.String,
            required: true,
            choices: [
                {
                    name: "Português",
                    value: "pt"
                },
                {
                    name: "English",
                    value: "en"
                }
            ]
        }
    ],

    run: async (client, interaction) => {
        if (!interaction.member.permissions.has(Discord.PermissionFlagsBits.ManageGuild)) {
            const lang = userLanguages[interaction.locale] || userLanguages["en"];
            return interaction.reply({ content: lang.noPermission, ephemeral: true });
        }

        const language = interaction.options.getString("language");
        await db.set(`channel_language_${interaction.channel.id}`, language);

        const lang = userLanguages[language];

        await interaction.reply({
            embeds: [
                new Discord.EmbedBuilder()
                    .setDescription(lang.panelSentSuccess.replace("{0}", interaction.user))
            ],
            ephemeral: true
        });

        interaction.channel.send({
            embeds: [
                new Discord.EmbedBuilder()
                    .setAuthor({ name: lang.welcomeSupport, iconURL: interaction.guild.iconURL({ dynamic: true }) })
                    .setDescription(lang.supportDescription)
                    .setFooter({ text: lang.serviceProvidedBy, iconURL: interaction.guild.iconURL({ dynamic: true }) })
                    .setImage('https://cdn.discordapp.com/attachments/1199919155080597675/1200559505084256346/Picsart_23-06-05_02-22-12-728.png?ex=65c69f2b&is=65b42a2b&hm=5be47cb263c84d0374da4506441975b6e3c64974118df0ac3f50035372fb84a4&')
            ],
            components: [
                new Discord.ActionRowBuilder()
                    .addComponents(
                        new Discord.ButtonBuilder()
                            .setCustomId("criar_ticket")
                            .setEmoji("🧰")
                            .setLabel(lang.startSupport)
                            .setStyle(Discord.ButtonStyle.Secondary)
                    )
            ]
        });
    }
}