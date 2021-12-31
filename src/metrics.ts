import { collectDefaultMetrics, Gauge, register } from 'prom-client'
import { fetchServerStatus } from './database.js'
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
		queryOpCounter.set(status.opcounters.query)
		updateOpCounter.set(status.opcounters.update)
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
const queryOpCounter = new Gauge({
	name: 'mongodb_query_op_count',
	help: 'Number of queries executed by the database.',
	registers: [ register ],
})
const updateOpCounter = new Gauge({
	name: 'mongodb_update_op_count',
	help: 'Number of updates executed by the database.',
	registers: [ register ],
})


