
---
## Implementing Observability and Monitoring for a Microservices System on
 Azure Kubernetes Service (AKS) using Elastic Stack
 Description: Developed a full observability solution for microservices on Azure Kubernetes Service (AKS),
 featuring dual CI/CD pipelines (Dev & Staging) for secure, automated deployments and Elastic Stack integration
 for real-time monitoring and issue diagnosis.
 • Responsibilities:– Designed and managed two CI/CD pipelines:
 * Dev pipeline: Performed static code analysis using Semgrep and container image scanning with Trivy
 for early vulnerability detection.
 * Staging pipeline: Automated Docker image builds and packaging, updated Helm chart repository to
 synchronize deployments to Azure Kubernetes Service (AKS) via ArgoCD.– Collected logs, metrics, and traces using Beats and APM agents, analyzed data in Elasticsearch, and
 visualized system health in Kibana dashboards.– Managed the application data layer with Azure Database for PostgreSQL and hosted the static frontend via
 Azure Static Web App.
 • Technologies: Jenkins, ArgoCD, ACR , AKS, Azure Static Web App, Azure PostgreSQL, Elastic Stack
 (Elasticsearch, Kibana, Filebeat, Metricbeat, Heartbeat, APM), Semgrep, Trivy, Helm

---

## Architecture overview
<img width="1030" height="765" alt="Screenshot 2025-10-29 215351" src="https://github.com/user-attachments/assets/7a6b0ed5-1915-45fc-b029-013ceb404ae9" />


---
