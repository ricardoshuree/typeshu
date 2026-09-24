import { autoUpdater } from 'electron-updater'
import { app, dialog } from 'electron'

export function initAutoUpdater(): void {
  if (!app.isPackaged) return

  autoUpdater.autoDownload = false

  autoUpdater.on('update-available', () => {
    dialog.showMessageBox({
      type: 'info',
      title: 'Atualização disponível',
      message: 'Uma nova versão do TypeShu está disponível. Deseja baixar agora?',
      buttons: ['Sim', 'Não'],
    }).then(({ response }) => {
      if (response === 0) autoUpdater.downloadUpdate()
    })
  })

  autoUpdater.on('update-downloaded', () => {
    dialog.showMessageBox({
      type: 'info',
      title: 'Atualização pronta',
      message: 'A atualização foi baixada. O aplicativo será reiniciado para instalar.',
      buttons: ['Reiniciar agora'],
    }).then(() => {
      autoUpdater.quitAndInstall()
    })
  })

  autoUpdater.checkForUpdates().catch(() => {})
}
