-- Webhook secrets belong on the payment gateway. Model name belongs on the AI provider.
ALTER TABLE "PaymentGateway" ADD COLUMN "webhookSecretEnc" TEXT;
ALTER TABLE "AiProvider" ADD COLUMN "modelName" TEXT;
