import './preload'

import {
  fileToBase64,
  fixCut,
  fixDarkTheme,
  fixLinkClick,
  fixPanelHover,
  handleToolbarClick,
  saveVditorOptions,
} from './utils'

import { merge } from 'lodash'
import Vditor from 'vditor'
import { format } from 'date-fns'
import 'vditor/dist/index.css'
import { t, lang } from './lang'
import { toolbar } from './toolbar'
import { fixTableIr } from './fix-table-ir'
import './main.css'

function initVditor(msg) {
  console.log("initVditor")
  console.log('msg', msg)
  let inputTimer
  let defaultOptions: any = {}

  if (msg.theme === 'dark') {
    // vditor.setTheme('dark', 'dark')
    defaultOptions = merge(defaultOptions, {
      theme: 'dark',
      preview: {
        theme: {
          current: 'dark',
        },
      },
      // this local lute path is bugged. doesn't work with foo/bar.md b/c tries to get lute in foo/assets/lute.min.js when you launch the editor
//      '_lutePath': "https://file%2B.vscode-resource.vscode-cdn.net/home/malvira/repos/vscode-markdown-editor/media/dist/main.js"
//      '_lutePath': "assets/lute.min.js"
//this works      '_lutePath': "https://file+.vscode-resource.vscode-cdn.net/home/malvira/repos/foam-template/assets/lute.min.js"
// this should be what the asWebviewURI would return for the contex.ExtensionPath based URI
// this also works. So if I can get this string generated in the proper way and passed in here
// then I can just ship a local lute.min.js
// I think I was able to get the extenstion path easily enough. maybe just hack in the URI scheme part
//      '_lutePath': "https://file+.vscode-resource.vscode-cdn.net/home/malvira/repos/vscode-markdown-editor/media/dist/lute.min.js"
      '_lutePath': msg.options.lutePath
})
  }
  defaultOptions = merge(defaultOptions, msg.options, {
    preview: {
      math: {
        inlineDigit: true,
      }
    }
  })
  if (window.vditor) {
    vditor.destroy()
    window.vditor = null
  }
  window.vditor = new Vditor('app', {
    width: '100%',
    height: '100%',
    minHeight: '100%',
    lang,
    value: msg.content,
    mode: 'ir',
    cache: { enable: false },
    toolbar,
    toolbarConfig: { pin: true },
    ...defaultOptions,
    after() {
      fixDarkTheme()
      handleToolbarClick()
      fixTableIr()
      fixPanelHover()
    },
    input() {
      inputTimer && clearTimeout(inputTimer)
      inputTimer = setTimeout(() => {
        vscode.postMessage({ command: 'edit', content: vditor.getValue() })
      }, 100)
    },
    upload: {
      url: '/fuzzy', // ?????? url ?????????????????????????????? see: https://github.com/Vanessa219/vditor/blob/d7628a0a7cfe5d28b055469bf06fb0ba5cfaa1b2/src/ts/util/fixBrowserBehavior.ts#L1409
      async handler(files) {
        // console.log('files', files)
        let fileInfos = await Promise.all(
          files.map(async (f) => {
            const d = new Date()
            return {
              base64: await fileToBase64(f),
              name: `${format(new Date(), 'yyyyMMdd_HHmmss')}_${f.name}`.replace(
                /[^\w-_.]+/,
                '_'
              ),
            }
          })
        )
        vscode.postMessage({
          command: 'upload',
          files: fileInfos,
        })
      },
    },
  })
}

window.addEventListener('message', (e) => {
  const msg = e.data
  // console.log('msg from vscode', msg)
  switch (msg.command) {
    case 'update': {
      if (msg.type === 'init') {
        if (msg.options && msg.options.useVscodeThemeColor) {
          document.body.setAttribute('data-use-vscode-theme-color', '1')
        } else {
          document.body.setAttribute('data-use-vscode-theme-color', '0')
        }
        try {
          initVditor(msg)
        } catch (error) {
          // reset options when error
          console.error(error)
          initVditor({content: msg.content})
          saveVditorOptions()
        }
        console.log('initVditor')
      } else {
        vditor.setValue(msg.content)
        console.log('setValue')
      }
      break
    }
    case 'uploaded': {
      msg.files.forEach((f) => {
        if (f.endsWith('.wav')) {
          vditor.insertValue(
            `\n\n<audio controls="controls" src="${f}"></audio>\n\n`
          )
        } else {
          const i = new Image()
          i.src = f
          i.onload = () => {
            vditor.insertValue(`\n\n![](${f})\n\n`)
          }
          i.onerror = () => {
            vditor.insertValue(`\n\n[${f.split('/').slice(-1)[0]}](${f})\n\n`)
          }
        }
      })
      break
    }
    default:
      break
  }
})

fixLinkClick()
fixCut()

vscode.postMessage({ command: 'ready' })
