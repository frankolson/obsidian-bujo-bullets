import { Menu, Plugin } from 'obsidian';
import { CommandHandler } from './handlers/command-handler';
import { isBulletText, updateBulletType } from './core/bullet-utils';
import * as DOMPurify from 'isomorphic-dompurify';
import {
  BuJoPluginSettings,
  BuJoPluginSettingTab,
  DEFAULT_SETTINGS
} from './settings';

export type Bullet = {
  name: string
  character: string
}

export const AVAILABLE_BULLETS_TYPES: Bullet[] = [
  { name: 'Incomplete', character: ' ' },
  { name: 'Complete', character: 'x' },
  { name: 'Irrelevant', character: '-' },
  { name: 'Migrated', character: '>' },
  { name: 'Scheduled', character: '<' },
  { name: 'Event', character: 'o' },
]

export default class BuJoPlugin extends Plugin {
  settings: BuJoPluginSettings;
  commandHandler: CommandHandler;

  async onload() {
    await this.loadSettings();
    this.commandHandler = new CommandHandler(this);

    this.registerMarkdownPostProcessor((element, _context) => {
      const renderedBullets = element.findAll('ul > li');
      const renderedCheckboxes = renderedBullets.filter((bullet) =>
        bullet.classList.contains('task-list-item')
      );

      if (renderedBullets.length === 0) {
        return
      }

      // Process signifiers
      for (let bullet of renderedBullets) {
        const bulletText = bullet.innerText
        const signifiers = this.settings.signifiers;
        
        for (let signifier of signifiers) {
          const signifierText = signifier.value;

          if (bulletText.startsWith(signifierText + ' ')) {
            let html = bullet.innerHTML;
            let sanitizedText = DOMPurify.sanitize(signifierText);
            
            html = html.replace(signifierText, `<span class="bujo-bullet-signifier">${sanitizedText}</span>`);
            bullet.innerHTML = html
          }
        }
      }

      // Process checkboxes
      if (renderedCheckboxes.length === 0) {
        return
      }

      renderedCheckboxes.forEach((bullet, index) => {
        bullet.setAttribute('data-bullet-id', index.toString())
      })

      for (const bullet of renderedCheckboxes) {
        const bulletTaskValue = bullet.getAttribute('data-task')
        const bulletType = !bulletTaskValue
          ? AVAILABLE_BULLETS_TYPES.find((type) => type.character === ' ')
          : AVAILABLE_BULLETS_TYPES.find((type) => type.character === bulletTaskValue)
        if (!bulletType) {
          continue
        }

        const checkbox = bullet.querySelector('input[type="checkbox"]') as HTMLInputElement | null
        if (!checkbox) {
          continue
        }

        checkbox.addEventListener('contextmenu', (event: MouseEvent) => {
          const menu = new Menu()
          const bulletId = bullet.getAttribute('data-bullet-id')

          for (const type of AVAILABLE_BULLETS_TYPES) {
            if (bulletType.character === type.character) {
              continue
            }

            menu.addItem((item) => {
              item.setTitle(`Change to: ${type.name}`)
              item.onClick(async () => {
                
                const vault = this.app.vault
                const file = this.app.workspace.getActiveFile()
                if (!file) {
                  return
                }

                vault.process(file, (data) => {
                  const lines = data.split('\n')
                  let bulletCount = 0
                  let bulletIndex = -1
                  let lineIndex = -1
                  for (let i = 0; i < lines.length; i++) {
                    lineIndex++
                    if (isBulletText(lines[i])) {
                      if (bulletCount.toString() === bulletId) {
                        bulletIndex = i
                        break
                      }
                      bulletCount++
                    }
                  }

                  if (bulletIndex === -1) {
                    console.error('Bullet not found')
                    return data
                  }

                  const updatedLines = [
                    ...lines.slice(0, lineIndex),
                    updateBulletType(lines[bulletIndex], type),
                    ...lines.slice(bulletIndex + 1)
                  ]

                  return updatedLines.join('\n')
                });
              })
            })
          }

          menu.showAtPosition({ x: event.clientX, y: event.clientY });
        })
      }
    })
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    this.addSettingTab(new BuJoPluginSettingTab(this.app, this));
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}
