# IWTC K3s deployment

Argo CD applies this directory to the `iwtc` namespace. Secret values are intentionally not stored in Git.

Before registering the Argo CD application, create a URL-safe PostgreSQL password and the runtime secret on the K3s server:

```bash
sudo k3s kubectl create namespace iwtc --dry-run=client -o yaml \
  | sudo k3s kubectl apply -f -

sudo k3s kubectl -n iwtc create secret generic iwtc-secrets \
  --from-literal=POSTGRES_DB=iwtc \
  --from-literal=POSTGRES_USER=iwtc \
  --from-literal=POSTGRES_PASSWORD='REPLACE_WITH_URL_SAFE_PASSWORD' \
  --from-literal=DATABASE_URL='postgresql://iwtc:REPLACE_WITH_URL_SAFE_PASSWORD@postgres:5432/iwtc' \
  --from-literal=MINIO_ROOT_USER='REPLACE_WITH_MINIO_ADMIN_USER' \
  --from-literal=MINIO_ROOT_PASSWORD='REPLACE_WITH_MINIO_ADMIN_PASSWORD' \
  --from-literal=S3_ACCESS_KEY_ID='REPLACE_WITH_BACKEND_ACCESS_KEY' \
  --from-literal=S3_SECRET_ACCESS_KEY='REPLACE_WITH_BACKEND_SECRET_KEY' \
  --from-literal=JWT_ACCESS_SECRET='REPLACE_WITH_AT_LEAST_32_RANDOM_CHARACTERS' \
  --from-literal=JWT_REFRESH_SECRET='REPLACE_WITH_A_DIFFERENT_RANDOM_SECRET'
```

The PostgreSQL password appears inside `DATABASE_URL`; either use URL-safe characters or percent-encode reserved characters there. Use different MinIO administrator and backend application credentials. Do not commit a rendered Secret manifest.

Register the application after the first backend image has been published to GHCR:

```bash
sudo k3s kubectl apply -f argocd/application.yaml
sudo k3s kubectl -n argocd get application iwtc-backend
sudo k3s kubectl -n iwtc get pods,pvc,svc,ingress,certificate
```
