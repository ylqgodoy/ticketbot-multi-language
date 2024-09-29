const Discord = require("discord.js");
const config = require("../config.json");
const categoria = require("../categoria.json");
const { QuickDB } = require("quick.db");
const fs = require("fs");
const randomString = require("randomized-string");
const sourcebin = require("sourcebin");
const db = new QuickDB();
const db2 = new QuickDB({ table: "assum" });
const languages = require("../translation/languages-ticket.json");

let select = null;
let categoria_ticket = null;
const ticketsAbertos = {};

module.exports = {
  name: "ticket",
  async execute(interaction, client) {
    const options = categoria.a.map((option) => ({
      label: option.label,
      description: option.description,
      value: option.value,
      emoji: option.emoji,
    }));

    const language = await db.get(`channel_language_${interaction.channel.id}`) || "en";
    const lang = languages[language];

    if (interaction.customId === "criar_ticket") {
      if (ticketsAbertos[interaction.user.id]) {
        interaction.reply({
          ephemeral: true,
          content: lang.ticketAlreadyOpen,
        });
        return;
      }

      interaction.reply({
        ephemeral: true,
        embeds: [
          new Discord.EmbedBuilder()
            .setDescription(lang.selectTicketType)
            .setFooter({
              text: lang.pleaseWait,
            }),
        ],
        components: [
          new Discord.ActionRowBuilder().addComponents(
            new Discord.StringSelectMenuBuilder()
              .addOptions(options)
              .setPlaceholder(lang.chooseCategory)
              .setCustomId("selectmenu")
          ),
        ],
      });
    }

    if (interaction.customId === "selectmenu") {
      const selectedValue = interaction.values[0];
      const selectedOption = categoria.a.find((option) => option.value === selectedValue);
      select = selectedOption.label;
      categoria_ticket = selectedOption.categoria;

      if (selectedOption) {
        const modal = new Discord.ModalBuilder()
          .setCustomId("modal_ticket")
          .setTitle(lang.describeReason);

        const title = new Discord.TextInputBuilder()
          .setCustomId("title")
          .setLabel(lang.whatIsReason)
          .setRequired(true)
          .setMaxLength(150)
          .setStyle(Discord.TextInputStyle.Short)
          .setPlaceholder(lang.writeHere);

        modal.addComponents(new Discord.ActionRowBuilder().addComponents(title));
        return interaction.showModal(modal);
      }
    }

    if (interaction.isModalSubmit() && interaction.customId === "modal_ticket") {
      ticketsAbertos[interaction.user.id] = true;
      const title = interaction.fields.getTextInputValue("title");

      const cargoIDs = config.cargo_staff;
      const permissionOverwrites = [
        {
          id: interaction.guild.id,
          deny: ["ViewChannel"],
        },
        {
          id: interaction.user.id,
          allow: ["ViewChannel", "SendMessages", "AttachFiles", "AddReactions"],
        },
      ];

      for (const cargoID of cargoIDs) {
        const cargo = interaction.guild.roles.cache.get(cargoID);
        if (cargo) {
          permissionOverwrites.push({
            id: cargo.id,
            allow: ["ViewChannel", "SendMessages", "AttachFiles", "AddReactions"],
          });
        }
      }

      const channel = await interaction.guild.channels.create({
        name: `🎫-${interaction.user.username}`,
        type: Discord.ChannelType.GuildText,
        parent: categoria_ticket,
        topic: interaction.user.id,
        permissionOverwrites: permissionOverwrites,
      });

      var randomToken = randomString.generate({ length: 6, charset: "hex" }).toUpperCase();

      await db.set(`ticket_${channel.id}`, {
        owner_id: interaction.user.id,
        title,
        selected: select,
        aaaaa: randomToken,
        language: language,
        assumed: lang.noOneHasTaken,
      });

      await db2.set(`avalia_${interaction.user.id}`, {
        assumiu: lang.noOneHasTaken,
      });

      const embed = new Discord.EmbedBuilder()
        .setTitle(lang.ticketOpened)
        .setDescription(lang.yourTicketOpened.replace("{0}", channel.url))
        .setColor("#c0c0c0");

      interaction.update({
        embeds: [embed],
        ephemeral: true,
        components: [
          new Discord.ActionRowBuilder().addComponents(
            new Discord.ButtonBuilder()
              .setLabel(lang.goToTicket)
              .setURL(channel.url)
              .setStyle(Discord.ButtonStyle.Link)
          ),
        ],
      });

      const collector = channel.createMessageCollector({
        filter: (m) => m.author.id === interaction.user.id,
        max: 1,
      });

      collector.on("end", (collected) => {
        if (collected.size > 0) {
          const a = collected.first();
          a.reply({
            content: lang.welcomeToTicket.replace("{0}", interaction.user),
          });
        }
      });

      const collectores = channel.createMessageCollector({
        filter: (m) => {
          const member = interaction.guild.members.cache.get(m.author.id);
          const rolesToCheck = config.cargo_staff;
          return member && rolesToCheck.some(roleID => member.roles.cache.has(roleID));
        },
        max: 1,
      });

      collectores.on("end", (collected) => {
        if (collected.size > 0) {
          const a = collected.first();
          interaction.user.send({
            content: lang.staffSentMessage.replace("{0}", a.author).replace("{1}", channel.url),
          });
        }
      });

      channel.send({
        embeds: [
          new Discord.EmbedBuilder()
            .setAuthor({
              name: `${interaction.guild.name}`,
              iconURL: interaction.guild.iconURL({ dynamic: true }),
            })
            .setDescription(
              `${lang.ticketRecoveryCode.replace("{0}", randomToken)}\n\n${lang.verifyTopic}\n${lang.ticketType.replace("{0}", select)}\n${lang.ticketReason.replace("{0}", title)}`
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
              .setLabel(lang.takeTicket)
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

    if (interaction.isButton() && interaction.customId === "sair_ticket") {
      const ticket = await db.get(`ticket_${interaction.channel.id}`);
      const user = await interaction.guild.members.cache.get(ticket.owner_id);

      if (interaction.user.id !== user.id) {
        return interaction.reply({
          embeds: [
            new Discord.EmbedBuilder().setDescription(
              lang.onlyOwnerCanLeave.replace("{0}", user)
            ),
          ],
        });
      }

      interaction.channel.edit({
        permissionOverwrites: [
          {
            id: interaction.user.id,
            deny: [
              "ViewChannel",
              "SendMessages",
              "AttachFiles",
              "AddReactions",
            ],
          },
        ],
      });

      interaction.reply({
        embeds: [
          new Discord.EmbedBuilder().setDescription(
            lang.userLeftTicket.replace("{0}", interaction.user)
          ),
        ],
        components: [
          new Discord.ActionRowBuilder().addComponents(
            new Discord.ButtonBuilder()
              .setCustomId("fechar_ticket")
              .setLabel(lang.closeTicket)
              .setEmoji("❌")
              .setStyle(Discord.ButtonStyle.Danger)
          ),
        ],
      });
    }

    if (interaction.isButton() && interaction.customId === "painel_ticket") {
      const ticket = await db.get(`ticket_${interaction.channel.id}`);
      const language = ticket.language;
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

      interaction.reply({
        embeds: [
          new Discord.EmbedBuilder().setDescription(
            lang.welcomeStaffPanel.replace("{0}", interaction.user)
          ),
        ],
        components: [
          new Discord.ActionRowBuilder().addComponents(
            new Discord.StringSelectMenuBuilder()
              .setCustomId("painel_staff")
              .setPlaceholder(lang.chooseOption)
              .addOptions(
                {
                  label: lang.renameRoom,
                  description: lang.changeRoomName,
                  value: "renome_chat",
                  emoji: "🏷"
                },
                {
                  label: lang.notifyMember,
                  description: lang.notifyUser,
                  value: "notify_user",
                  emoji: "🔔"
                },
                {
                  label: lang.addMember,
                  description: lang.addMemberToChat,
                  value: "add_member",
                  emoji: "✅"
                },
                {
                  label: lang.removeMember,
                  description: lang.removeMemberFromChat,
                  value: "remove_member",
                  emoji: "❌"
                },
                {
                  label: lang.createCall,
                  description: lang.createCallDesc,
                  value: "create_call",
                  emoji: "📞"
                },
                {
                  label: lang.deleteCall,
                  description: lang.deleteCallDesc,
                  value: "delete_call",
                  emoji: "📞"
                }
              )
          ),
        ],
        ephemeral: true,
      });
    }

    if (interaction.customId === "fechar_ticket") {
      const user1 = interaction.guild.members.cache.get(interaction.user.id);
      const roleIdToCheck = config.cargo_staff;
      const hasRequiredRole = roleIdToCheck.some(roleID => user1.roles.cache.has(roleID));

      const ticket = await db.get(`ticket_${interaction.channel.id}`);
      const language = ticket.language;
      const lang = languages[language];

      if (!hasRequiredRole) {
        await interaction.reply({
          content: lang.noPermission,
          ephemeral: true
        });
        return;
      }

      const user = await interaction.guild.members.cache.get(ticket.owner_id);
      delete ticketsAbertos[user.id];

      const configData = fs.readFileSync("assumed.json", "utf-8");
      const config1 = JSON.parse(configData);
      const userId = interaction.user.id;
      const quantidadeAssumido = config1[userId];
      const id = ticket.aaaaa;
      const assum = await interaction.guild.members.cache.get(ticket.assumed) || lang.noOneHasTaken;

      await interaction.update({
        embeds: [
          new Discord.EmbedBuilder()
            .setDescription(
              lang.deletingTicket.replace("{0}", "5")
            ),
        ],
        components: [],
      });

      for (let i = 4; i >= 1; i--) {
        await new Promise((resolve) => setTimeout(resolve, 1000));

        await interaction.editReply({
          embeds: [
            new Discord.EmbedBuilder()
              .setDescription(
                lang.deletingTicket.replace("{0}", i.toString())
              ),
          ],
          components: [],
        });
      }

      let output = interaction.channel.messages.cache
        .filter((m) => m.author.bot !== true)
        .map(
          (m) => `${new Date(m.createdTimestamp).toLocaleString("pt-BR")}-${m.author.username}#${m.author.discriminator}: ${m.attachments.size > 0 ? m.attachments.first().proxyURL : m.content}`
        )
        .reverse()
        .join("\n");

      if (output.length < 1) output = lang.noConversation;

      try {
        response = await sourcebin.create({
          title: `${lang.ticketOpened}: ${interaction.channel.name}`,
          description: `Made by @kyzhatesneurotoxin < Telegram.`,
          files: [
            {
              content: output,
              language: "text",
            },
          ],
        });
      } catch (e) {
        return interaction.editReply({
          embeds: [
            new Discord.EmbedBuilder()
              .setDescription(
                lang.errorSavingLogs.replace("{0}", interaction.channel)
              ),
          ],
          components: [],
          ephemeral: true,
        });
      }

      await user.send({
        embeds: [
          new Discord.EmbedBuilder()
            .setTitle(`📄 \`LOGS\``)
            .addFields(
              {
                name: lang.closeTicket,
                value: `${interaction.user}`,
                inline: true
              },
              {
                name: lang.ticketOpened,
                value: `${user}`,
                inline: true
              },
              {
                name: lang.staffWhoTookOver,
                value: `${assum}`,
                inline: true
              },
              {
                name: lang.rating,
                value: `${quantidadeAssumido}`,
                inline: true
              },
              {
                name: lang.ticketType,
                value: `*\`${id}\`*`,
                inline: true
              },
              {
                name: lang.closeTicket,
                value: `<t:${~~(new Date() / 1000)}:R>`,
                inline: true
              },
            ),
        ],
        components: [
          new Discord.ActionRowBuilder().addComponents(
            new Discord.ButtonBuilder()
              .setStyle(5)
              .setEmoji("<:prancheta2:1130047888458797146>")
              .setLabel(lang.goToTicket)
              .setURL(response.url)
          ),
        ],
      });

      await user.send({
        embeds: [
          new Discord.EmbedBuilder()
            .setDescription(lang.rateService)
        ],
        components: [
          new Discord.ActionRowBuilder()
            .addComponents(
              new Discord.ButtonBuilder()
                .setCustomId("avaliation")
                .setEmoji("⭐")
                .setLabel(lang.rateHere)
                .setStyle(Discord.ButtonStyle.Secondary)
            )
        ]
      });

      const channel_send = interaction.guild.channels.cache.get(config.canal_logs);

      if (!channel_send) {
        console.error(lang.channelNotFound.replace("{0}", config.canal_logs));
        return;
      }

      await channel_send.send({
        embeds: [
          new Discord.EmbedBuilder()
            .setTitle(`📄 \`LOGS\``)
            .addFields(
              {
                name: lang.closeTicket,
                value: `${interaction.user}`,
                inline: true
              },
              {
                name: lang.ticketOpened,
                value: `${user}`,
                inline: true
              },
              {
                name: lang.staffWhoTookOver,
                value: `${assum}`,
                inline: true
              },
              {
                name: lang.rating,
                value: `${quantidadeAssumido}`,
                inline: true
              },
              {
                name: lang.ticketType,
                value: `*\`${id}\`*`,
                inline: true
              },
              {
                name: lang.closeTicket,
                value: `<t:${~~(new Date() / 1000)}:R>`,
                inline: true
              },
            )
        ],
        components: [
          new Discord.ActionRowBuilder().addComponents(
            new Discord.ButtonBuilder()
              .setStyle(5)
              .setEmoji("<:prancheta2:1130047888458797146>")
              .setLabel(lang.goToTicket)
              .setURL(response.url)
          ),
        ],
      });

      interaction.channel.delete();
    }

    if (interaction.customId === "painel_staff") {
      const ticket = await db.get(`ticket_${interaction.channel.id}`);
      const language = ticket.language;
      const lang = languages[language];

      const options = interaction.values[0];
      const user = await interaction.guild.members.cache.get(ticket.owner_id);

      if (options === "delete_call") {
        const channel_find = await interaction.guild.channels.cache.find(
          (c) =>
            c.name === `📞-${interaction.user.username.toLowerCase().replace(/ /g, "-")}`
        );

        if (!channel_find)
          return interaction.update({
            embeds: [
              new Discord.EmbedBuilder().setDescription(
                lang.youDoNotHaveOpenCall
              ),
            ],
            components: [],
            ephemeral: true,
          });

        await channel_find.delete();

        interaction.update({
          embeds: [
            new Discord.EmbedBuilder().setDescription(
              lang.callDeletedSuccess
            ),
          ],
          components: [],
          ephemeral: true,
        });
      }

      if (options === "create_call") {
        const channel_find = await interaction.guild.channels.cache.find(
          (c) =>
            c.name === `📞-${interaction.user.username.toLowerCase().replace(/ /g, "-")}`
        );

        if (channel_find)
          return interaction.update({
            embeds: [
              new Discord.EmbedBuilder().setDescription(
                lang.alreadyHaveOpenCall.replace("{0}", channel_find)
              ),
            ],
            components: [],
            ephemeral: true,
          });

        const channel = await interaction.guild.channels.create({
          name: `📞-${interaction.user.username}`,
          type: Discord.ChannelType.GuildVoice,
          parent: interaction.channel.parent,
          permissionOverwrites: [
            {
              id: interaction.guild.id,
              deny: ["ViewChannel"],
            },
            {
              id: interaction.user.id,
              allow: ["ViewChannel", "Connect", "Speak"],
            },
            {
              id: user.id,
              allow: ["ViewChannel", "Connect", "Speak"],
            },
          ],
        });

        interaction.update({
          embeds: [
            new Discord.EmbedBuilder().setDescription(
              lang.callCreatedSuccess.replace("{0}", channel)
            ),
          ],
          components: [
            new Discord.ActionRowBuilder().addComponents(
              new Discord.ButtonBuilder()
                .setStyle(5)
                .setLabel(lang.joinCall)
                .setURL(
                  `https://discord.com/channels/${interaction.guild.id}/${channel.id}`
                )
            ),
          ],
          ephemeral: true,
        });
      }

      if (options === "remove_member") {
        interaction.update({
          embeds: [
            new Discord.EmbedBuilder().setDescription(
              lang.mentionUserToRemove
            ),
          ],
          components: [],
          ephemeral: true,
        });

        const filter = (m) => m.author.id === interaction.user.id;
        const collector = interaction.channel.createMessageCollector({
          filter,
          max: 1,
          time: 60000,
        });

        collector.on("collect", async (m) => {
          const member =
            m.mentions.members.first() ||
            (await interaction.guild.members
              .fetch(m.content)
              .catch(() => null));

          if (!member) {
            return interaction.followUp({
              embeds: [
                new Discord.EmbedBuilder().setDescription(
                  lang.couldNotFindUser.replace("{0}", m.content)
                ),
              ],
              ephemeral: true,
            });
          }

          const perms = interaction.channel.permissionOverwrites.cache.get(
            member.id
          );
          if (!perms || !perms.allow.has("ViewChannel")) {
            return interaction.followUp({
              embeds: [
                new Discord.EmbedBuilder().setDescription(
                  lang.userNoAccessToTicket.replace("{0}", member.user.username).replace("{1}", member.id)
                ),
              ],
              ephemeral: true,
            });
          }

          await interaction.channel.permissionOverwrites.delete(member);

          interaction.followUp({
            embeds: [
              new Discord.EmbedBuilder().setDescription(
                lang.userRemovedSuccess.replace("{0}", member.user.username).replace("{1}", member.id)
              ),
            ],
            ephemeral: true,
          });
        });
      }

      if (options === "add_member") {
        interaction.update({
          embeds: [
            new Discord.EmbedBuilder().setDescription(
              lang.mentionUserToAdd
            ),
          ],
          components: [],
          ephemeral: true,
        });

        const filter = (m) => m.author.id === interaction.user.id;
        const collector = interaction.channel.createMessageCollector({
          filter,
          max: 1,
          time: 60000,
        });

        collector.on("collect", async (m) => {
          const member =
            m.mentions.members.first() ||
            (await interaction.guild.members
              .fetch(m.content)
              .catch(() => null));

          if (!member) {
            return interaction.followUp({
              embeds: [
                new Discord.EmbedBuilder().setDescription(
                  lang.couldNotFindUser.replace("{0}", m.content)
                ),
              ],
              ephemeral: true,
            });
          }

          const perms = interaction.channel.permissionOverwrites.cache.get(
            member.id
          );
          if (perms && perms.allow.has("ViewChannel")) {
            return interaction.followUp({
              embeds: [
                new Discord.EmbedBuilder().setDescription(
                  lang.userAlreadyHasAccess.replace("{0}", member.user.username).replace("{1}", member.id)
                ),
              ],
              ephemeral: true,
            });
          }

          await interaction.channel.permissionOverwrites.edit(member, {
            ViewChannel: true,
            SendMessages: true,
            AttachFiles: true,
            AddReactions: true,
          });

          interaction.followUp({
            embeds: [
              new Discord.EmbedBuilder().setDescription(
                lang.userAddedSuccess.replace("{0}", member.user.username).replace("{1}", member.id)
              ),
            ],
            ephemeral: true,
          });
        });
      }

      if (options === "notify_user") {
        try {
          await user.send({
            embeds: [
              new Discord.EmbedBuilder().setDescription(
                lang.staffWaitingResponse.replace("{0}", interaction.channel)
              ),
            ],
          });

          interaction.update({
            embeds: [
              new Discord.EmbedBuilder().setDescription(
                lang.userNotified.replace("{0}", user)
              ),
            ],
            components: [],
            ephemeral: true,
          });
        } catch (error) {
          interaction.update({
            embeds: [
              new Discord.EmbedBuilder().setDescription(
                lang.couldNotSendMessage
              ),
            ],
            components: [],
            ephemeral: true,
          });
        }
      }

      if (options === "renome_chat") {
        interaction.update({
          embeds: [
            new Discord.EmbedBuilder().setDescription(
              lang.enterDesiredName
            ),
          ],
          components: [],
          ephemeral: true,
        });

        const filter = (m) => m.author.id === interaction.user.id;
        const collector = interaction.channel.createMessageCollector({
          filter,
          max: 1,
          time: 60000,
        });

        collector.on("collect", async (m) => {
          const newName = m.content;
          await interaction.channel.setName(newName);

          interaction.followUp({
            embeds: [
              new Discord.EmbedBuilder().setDescription(
                lang.channelNameChanged.replace("{0}", newName)
              ),
            ],
            ephemeral: true,
          });
        });
      }
    }

    if (interaction.customId === "avaliation") {
      const modal = new Discord.ModalBuilder()
        .setCustomId("modal_avaliation")
        .setTitle(lang.giveYourRating);

      const nota = new Discord.TextInputBuilder()
        .setCustomId("nota")
        .setLabel(lang.whatIsYourRating)
        .setStyle(Discord.TextInputStyle.Short)
        .setPlaceholder(lang.chooseOneToFive)
        .setRequired(true);

      const avaliacao = new Discord.TextInputBuilder()
        .setCustomId("avaliacao")
        .setLabel(lang.whatIsYourFeedback)
        .setStyle(Discord.TextInputStyle.Paragraph)
        .setPlaceholder(lang.describeService)
        .setRequired(true);

      const consideracoes = new Discord.TextInputBuilder()
        .setCustomId("consideracoes")
        .setLabel(lang.finalThoughts)
        .setStyle(Discord.TextInputStyle.Paragraph)
        .setPlaceholder(lang.exampleFinalThoughts)
        .setRequired(true);

      modal.addComponents(
        new Discord.ActionRowBuilder().addComponents(nota),
        new Discord.ActionRowBuilder().addComponents(avaliacao),
        new Discord.ActionRowBuilder().addComponents(consideracoes)
      );

      await interaction.showModal(modal);
    }

    if (interaction.customId === "modal_avaliation") {
      const ticket = await db.get(`ticket_${interaction.channel.id}`);
      const language = ticket.language;
      const lang = languages[language];

      const nota = interaction.fields.getTextInputValue("nota");
      const avaliacao = interaction.fields.getTextInputValue("avaliacao");
      const consideracoes = interaction.fields.getTextInputValue("consideracoes");

      const channel = interaction.guild.channels.cache.get(config.canal_avaliacao);

      if (!channel) {
        console.error(lang.channelNotFound.replace("{0}", config.canal_avaliacao));
        return;
      }

      const assumiu = await db2.get(`avalia_${interaction.user.id}.assumiu`);

      if (isNaN(nota) || nota < 1 || nota > 5) {
        return interaction.reply({
          embeds: [
            new Discord.EmbedBuilder().setDescription(
              lang.invalidRating.replace("{0}", interaction.user)
            ),
          ],
          ephemeral: true,
        });
      }

      channel.send({
        embeds: [
          new Discord.EmbedBuilder()
            .setTitle(lang.newEvaluation)
            .addFields(
              {
                name: lang.evaluationSentBy,
                value: `${interaction.user}`,
                inline: true,
              },
              {
                name: lang.rating,
                value: `${nota}`,
                inline: true,
              },
              {
                name: lang.evaluation,
                value: `${avaliacao}`,
                inline: false,
              },
              {
                name: lang.staffWhoTookOver,
                value: `${assumiu}`,
                inline: true,
              },
              {
                name: lang.finalConsiderations,
                value: `${consideracoes}`,
                inline: false,
              },
              {
                name: lang.dateTime,
                value: `<t:${~~(new Date() / 1000)}:R>`,
                inline: true,
              }
            ),
        ],
      });

      interaction.reply({
        embeds: [
          new Discord.EmbedBuilder().setDescription(
            lang.evaluationSubmitted
          ),
        ],
        ephemeral: true,
      });
    }
  },
};