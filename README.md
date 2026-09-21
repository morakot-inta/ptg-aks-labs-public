# PTG — AKS hands-on labs

Everything you need to copy and paste during the session. Five labs, one folder each.

**Session:** 14:00–17:00 · **Format:** hands-on · you work in your own namespace.

---

## The labs

| | Lab | Time | You finish when |
|---|---|---|---|
| 0 | [Get connected](lab0-connect/) | 15 min | `kubectl get pods` says *No resources found* |
| 1 | [Build your image into ACR](lab1-build/) | 15 min | your tag is listed in the registry |
| 2 | [Deploy it](lab2-deployment/) | 45 min | `kubectl get deploy` shows `READY 2/2` |
| 3 | [Mount a secret from Key Vault](lab3-secret/) | 15 min | you can `cat` the secret inside the pod |
| 4 | [Wire up Workload Identity](lab4-workload-identity/) | 45 min | you write a file to Azure Storage and read it back, with no key anywhere |
