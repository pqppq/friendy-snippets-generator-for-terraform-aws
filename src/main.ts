import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs"
import remarkParse from "remark-parse"
import remarkHtml from "remark-html"
import { remark } from "remark"
import { visit } from 'unist-util-visit';
import chalk from "chalk"

const DOCUMENT_ROOT = "https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources"
const TMP_DIR = "./tmp"

if (!existsSync(TMP_DIR)) {
	console.log(chalk.red("Please run 'npm run fetch' before generating snippets."));
	process.exit(1)
}

// pick up the services that you want generate snippets
// ⚡ LuaSnip would not work for too many snippets
const pickedServices = [
	'api_gateway',
	'apigateway',
	'batch',
	'cloudfront',
	'cloudwatch',
	'code',
	'cognito',
	'db',
	'default',
	'ebs',
	'dynamo',
	'ec2',
	'ecs',
	'ecr',
	'efs',
	'eip',
	'eks',
	'elastic',
	'iam',
	'kms',
	'lambda',
	'lb',
	'load_balancer',
	'memorydb',
	'network',
	'rds',
	'route53',
	's3',
	'ses',
	'sqs',
	'vpc',
	'waf'
]
const regex = new RegExp(`(${pickedServices.join("|")})`, 'i')
const files = readdirSync(TMP_DIR).filter(file => regex.test(file))

type extractResult = {
	resourceName: string
	body: string[] // multiple lines of code
}

const extractCode = async (fileName: string): Promise<extractResult | null> => {
	const resourceName = fileName.split('.')[0]
	const contents = readFileSync(`${TMP_DIR}/${fileName}`)
	const codes = []

	const picker = () => {
		return (tree) => {
			visit(tree, 'code', (node) => {
				const code = node.value as string
				if (code.match(`^resource "aws_${resourceName}"`)) {
					// Split the lines to make the snippets more organized in the snippets JSON file.
					const lines = code.split('\n').map(line => `"${line.replace(/(?<=[^\\])"/g, '\\"')}"`)
					codes.push(lines)
				}
			})
		}
	}

	console.log(chalk.green("processing:", resourceName));
	await remark()
		.use(remarkParse)
		.use(remarkHtml)
		.use(picker)
		.process(contents)

	if (codes.length === 0) return null

	return {
		resourceName,
		body: codes[0]
	}
}

const results = await Promise.all(files.map(file => extractCode(file)))
const snippets = results
	.filter(result => result !== null)
	.map(({ resourceName, body }) =>
		`\t"${resourceName}": {\n` +
		`\t\t"prefix": "${resourceName}",\n` +
		`\t\t"body": [\n` +
		`\t\t\t"# ${DOCUMENT_ROOT}/${resourceName}",\n` +
		`\t\t\t${body.join(',\n\t\t\t')}\n` +
		`\t\t]\n` +
		`\t}`)

if (!existsSync("./generated")) {
	mkdirSync("./generated")
}
// write snippets into file
writeFileSync('./generated/terraform.json', `{\n${snippets.join(',\n')}\n}`)
console.log("generated snippets ./terraform.json");
