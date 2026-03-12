import "@angular/compiler";
import { AppModule } from './app/app.module';
import {bootstrap} from "@angular-architects/module-federation-tools";

export const bootstrapRemoteApp = async (bootstrapOptions: any) => {
  // Check if running in local development mode (port 4201 proxy)
  const isLocalDevelopment =
    typeof window !== 'undefined' && window.location.port === '4201';

  let finalBootstrapOptions = bootstrapOptions;

  // In local dev, override MODULE_PARAMETERS with local config
  if (isLocalDevelopment) {
    try {
      console.log(
        '🔧 Local development mode detected - loading local config...',
      );
      const response = await fetch('/assets/talis-aspire-local-config.json');

      if (response.ok) {
        const localConfig = await response.json();

        // Find and update MODULE_PARAMETERS in the providers array
        const providers = bootstrapOptions?.providers || [];
        const moduleParamsProviderIndex = providers.findIndex(
          (p: any) => p?.provide === 'MODULE_PARAMETERS',
        );

        if (moduleParamsProviderIndex >= 0) {
          // Merge local config with existing MODULE_PARAMETERS
          const existingParams =
            providers[moduleParamsProviderIndex].useValue || {};
          providers[moduleParamsProviderIndex] = {
            provide: 'MODULE_PARAMETERS',
            useValue: {
              ...existingParams,
              ...localConfig,
            },
          };
        } else {
          // No existing MODULE_PARAMETERS provider, add it
          providers.push({
            provide: 'MODULE_PARAMETERS',
            useValue: localConfig,
          });
        }

        finalBootstrapOptions = {
          ...bootstrapOptions,
          providers,
        };

        console.log(
          '✅ Local config loaded and injected into MODULE_PARAMETERS:',
          localConfig,
        );
      } else {
        console.warn(
          '⚠️ Local config file not found. Copy talis-aspire-local-config.json.example to src/assets/talis-aspire-local-config.json',
        );
      }
    } catch (error) {
      console.error('❌ Error loading local config:', error);
    }
  }

  return bootstrap(AppModule(finalBootstrapOptions), {
    production: true,
    appType: 'microfrontend',
  }).then((r) => {
    console.log('custom remote app bootstrap success!', r);
    return r;
  });
};

