export interface SecretsProvider {
  get(key: string): string | undefined;
}

export class EnvSecretsProvider implements SecretsProvider {
  get(key: string): string | undefined {
    return process.env[key];
  }
}
