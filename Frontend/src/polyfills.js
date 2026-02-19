import { Buffer } from "buffer"
import process from "process"
import { EventEmitter } from "events"
import util from "util"

window.global = window
window.Buffer = Buffer
window.process = process
window.EventEmitter = EventEmitter
window.util = util
