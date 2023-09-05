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

// pick up the services that you want generate snippets(filter files by its names)
// ⚡ LuaSnip may not work for too many snippets
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

type SnippetBase = {
	resourceName: string
	body: string[] // multiple lines of code
	noURL?: boolean
}
const extractSnippetBases = async (fileName: string): Promise<SnippetBase | null> => {
	const resourceName = fileName.split('.')[0]
	const contents = readFileSync(`${TMP_DIR}/${fileName}`)
	const codeBlocks = []

	const picker = () => {
		return (tree) => {
			visit(tree, 'code', (node) => {
				const code = node.value as string
				if (code.match(`^resource "aws_${resourceName}"`)) {
					// Split the lines to make the snippets more organized in the snippets JSON file.
					const lines = code.split('\n').map(line => `"${line.replace(/(?<=[^\\])"/g, '\\"')}"`)
					codeBlocks.push(lines)
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

	if (codeBlocks.length === 0) return null

	return {
		resourceName,
		body: codeBlocks[0] // first code blockis almost always 'Example Usage'
	}
}

const defaultSnippetBases: SnippetBase[] = [
	{
		noURL: true,
		resourceName: "required_providers",
		body: [
			`"terraform {"`,
			`"\trequired_providers {"`,
			`"\t\taws = {"`,
			`"\t\t\tsource = \\"hashicorp/aws\\""`,
			`"\t\t\tversion = \\"~> 5.0\\""`,
			`"\t\t}"`,
			`""`,
			`"\t\t#\tbackend \\"s3\\" {"`,
			`"\t\t#\t\tbucket = \\"bucket name\\""`,
			`"\t\t#\t\tkey = \\"path/to/my/key\\""`,
			`"\t\t#\t\tregion = \\"\\""`,
			`"\t\t#\t}"`,
			`"\t}"`,
			`"}"`,
		],
	},
	{
		noURL: true,
		resourceName: "aws",
		body: [
			`"provider \\"aws\\" {"`,
			`"\tregion = $1"`,
			`"}"`,
		],
	},
	{
		noURL: true,
		resourceName: "var",
		body: [
			`"variable \\"$1\\" {"`,
			`"\ttype = $2"`,
			`"\tvalue = $3"`,
			`"\tdefault = $3"`,
			`"\tdescription = $4"`,
			`"}"`,
		],
	},
	{
		noURL: true,
		resourceName: "out",
		body: [
			`"output \\"$1\\" {"`,
			`"\tvalue = $2"`,
			`"\tdescription = $3"`,
			`"}"`,
		],
	}
]
const snippetBases = await Promise.all(files.map(file => extractSnippetBases(file)))
const snippets = [...defaultSnippetBases, ...snippetBases]
	.filter(result => result !== null)
	.map(({ resourceName, body, noURL }) =>
		`\t"${resourceName}": {\n` +
		`\t\t"prefix": "${resourceName}",\n` +
		`\t\t"body": [\n` +
		(noURL ? "" : `\t\t\t"# ${DOCUMENT_ROOT}/${resourceName}",\n`) +
		`\t\t\t${body.join(',\n\t\t\t')}\n` +
		`\t\t]\n` +
		`\t}`)

if (!existsSync("./generated")) {
	mkdirSync("./generated")
}
// write snippets into file
writeFileSync('./generated/terraform.json', `{\n${snippets.join(',\n')}\n}`)
console.log("generated snippets ./generated/terraform.json");
