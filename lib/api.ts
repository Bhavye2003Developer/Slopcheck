export const API = {
  npm: {
    registry:  (name: string) => `https://registry.npmjs.org/${name}`,
    downloads: (name: string) => `https://api.npmjs.org/downloads/point/last-month/${name}`,
    page:      (name: string) => `https://www.npmjs.com/package/${name}`,
  },
  pypi: {
    registry:  (name: string) => `https://pypi.org/pypi/${name}/json`,
    downloads: (name: string) => `https://pypistats.org/api/packages/${name}/recent`,
    page:      (name: string) => `https://pypi.org/project/${name}`,
  },
  rubygems: {
    registry:  (name: string) => `https://rubygems.org/api/v1/gems/${name}.json`,
    page:      (name: string) => `https://rubygems.org/gems/${name}`,
  },
  go: {
    list:      (mod: string) => `https://proxy.golang.org/${mod}/@v/list`,
    info:      (mod: string, ver: string) => `https://proxy.golang.org/${mod}/@v/${ver}.info`,
    page:      (mod: string) => `https://pkg.go.dev/${mod}`,
  },
  cargo: {
    registry:  (name: string) => `https://crates.io/api/v1/crates/${name}`,
    page:      (name: string) => `https://crates.io/crates/${name}`,
  },
};
