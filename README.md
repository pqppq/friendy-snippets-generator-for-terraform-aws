# Terraform AWS Snippet Generator

This repository generates Terraform snippets for [friendly-snippets](https://github.com/rafamadriz/friendly-snippets) from Terraform's online documentation.

## Usage

To start, run `npm run fetch`. This command creates the ./tmp directory and retrieves files from [hashicorp/terraform-provider-aws/website/docs/r](https://github.com/hashicorp/terraform-provider-aws/tree/main/website/docs/r) into it.

And then, run `npm run generate`. The snippet file `terraform.json` would be generated on `./generated` directory.
