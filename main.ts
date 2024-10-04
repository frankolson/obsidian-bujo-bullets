import { App, Editor, MarkdownView, Menu, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';

type Bullet = {
  name: string
  character: string
}

const AVAILABLE_BULLETS_TYPES: Bullet[] = [
  { name: 'Incomplete', character: ' ' },
  { name: 'Complete', character: 'x' },
  { name: 'Irrelevant', character: '-' },
  { name: 'Migrated', character: '>' },
  { name: 'Scheduled', character: '<' },
  { name: 'Event', character: 'o' },
]

export default class BuJoPlugin extends Plugin {
  async onload() {
    this.registerMarkdownPostProcessor((element, context) => {
      const renderedBullets = element.findAll('.task-list-item')
      if (renderedBullets.length === 0) {
        return
      }

      renderedBullets.forEach((bullet, index) => {
        bullet.setAttribute('data-bullet-id', index.toString())
      })

      for (const bullet of renderedBullets) {
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

                const fileContent = await vault.read(file)
                const fileLines = fileContent.split('\n')
                let bulletCount = 0
                let bulletIndex = -1
                let fileLineIndex = -1
                for (let i = 0; i < fileLines.length; i++) {
                  fileLineIndex++
                  if (fileLines[i].trim().startsWith('- [')) {
                    if (bulletCount.toString() === bulletId) {
                      bulletIndex = i
                      break
                    }
                    bulletCount++
                  }
                }

                if (bulletIndex === -1) {
                  console.error('Bullet not found')
                  return
                }

                const updatedFileLines =[
                  ...fileLines.slice(0, fileLineIndex),
                  fileLines[bulletIndex].replace(/- \[.\]/, `- [${type.character}]`),
                  ...fileLines.slice(bulletIndex + 1)
                ]
                
                await vault.modify(file, updatedFileLines.join('\n'))
              })
            })
          }

          menu.showAtPosition({ x: event.clientX, y: event.clientY });
        })
      }
    })
  }
}
