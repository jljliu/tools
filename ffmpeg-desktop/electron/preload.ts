import { ipcRenderer, contextBridge } from 'electron'

// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld('ipcRenderer', {
  on(channel: string, listener: (event: Electron.IpcRendererEvent, ...args: any[]) => void) {
    const subscription = (event: Electron.IpcRendererEvent, ...args: any[]) => listener(event, ...args)
    ipcRenderer.on(channel, subscription)

    // Return a function to remove the listener
    return () => {
      ipcRenderer.removeListener(channel, subscription)
    }
  },
  send(channel: string, ...args: any[]) {
    ipcRenderer.send(channel, ...args)
  },
  invoke(channel: string, ...args: any[]) {
    return ipcRenderer.invoke(channel, ...args)
  },
})
