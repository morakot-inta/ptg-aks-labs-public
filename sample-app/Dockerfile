FROM node:24-alpine

# curl is here on purpose. Step 5 verifies the published route from inside the
# cluster, and shipping curl with the application avoids pulling and cleaning
# up a second, throwaway image just to make one HTTP call.
RUN apk add --no-cache curl

WORKDIR /app

# Dependencies first, so a code change does not re-resolve the SDK every build.
# --no-audit --no-fund and the notifier off keep the build log to one line, so
# what an attendee reads in Lab 1 is the build and not npm's advertising.
ENV NPM_CONFIG_UPDATE_NOTIFIER=false
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

# No build step: Node runs the TypeScript file directly and strips the types.
COPY tsconfig.json index.ts ./

# The policy baseline refuses containers that run as root, so the image ships
# with a non-root user already created. The Deployments set runAsUser: 10001.
RUN adduser -D -u 10001 appuser \
 && chown -R 10001:10001 /app
USER 10001

EXPOSE 8080
CMD ["node", "index.ts"]
