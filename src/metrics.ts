import { collectDefaultMetrics, Gauge, register } from 'prom-client'
import { fetchServerStats, fetchServerStatus } from './database.js'
import { getKeyUsage } from './hypixelApi.js'
export { register } from 'prom-client'


// grafana integration
collectDefaultMetrics()

const apiKeyCounter = new Gauge({
	name: 'hypixel_api_key_usage',
	help: 'API requests in the past minute.',
	registers: [ register ],
	collect() {
		let keyUsage = getKeyUsage()
		apiKeyCounter.set(keyUsage.usage)
	}
})
const connectionsCounter = new Gauge({
	name: 'mongodb_current_connections',
	help: 'Number of active connections to the database.',
	registers: [ register ],
	async collect() {
		let status = await fetchServerStatus()

		connectionsCounter.set(status.connections.current)
		networkBytesInCounter.set(status.network.bytesIn)
		networkBytesOutCounter.set(status.network.bytesOut)
		readCounter.set(status.opLatencies.reads.ops)
		writeCounter.set(status.opLatencies.writes.ops)
	}
})
const networkBytesInCounter = new Gauge({
	name: 'mongodb_network_bytes_in',
	help: 'Number of bytes received by the database.',
	registers: [ register ],
})
const networkBytesOutCounter = new Gauge({
	name: 'mongodb_network_bytes_out',
	help: 'Number of bytes sent by the database.',
	registers: [ register ],
})
const readCounter = new Gauge({
	name: 'mongodb_read_ops',
	help: 'Number of read operations by the database.',
	registers: [ register ],
})
const writeCounter = new Gauge({
	name: 'mongodb_write_ops',
	help: 'Number of write operations by the database.',
	registers: [ register ],
})
const dbSizeCounter = new Gauge({
	name: 'mongodb_db_size',
	help: 'Size of the database in bytes.',
	registers: [ register ],
	async collect() {
		let stats = await fetchServerStats()

		dbSizeCounter.set(stats.dataSize + stats.indexSize)
	}
})

