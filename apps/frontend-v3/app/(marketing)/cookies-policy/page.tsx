'use client'

import { Box, Container } from '@chakra-ui/react'
import { Prose } from '@nikolovlazar/chakra-ui-prose'
import FadeInOnView from '@repo/lib/shared/components/containers/FadeInOnView'

export default function Cookies() {
  return (
    <Container py="2xl">
      <Prose>
        <div className="pb-4">
          <FadeInOnView>
            <div className="subsection">
              <Box mt="3xl">
                <h1>Rootstock Cookies Policy</h1>
                <p>
                  <em>Last updated: October 2026</em>
                </p>
              </Box>
            </div>
          </FadeInOnView>
          <FadeInOnView>
            <div className="subsection">
              <h2>1. The published application uses no cookies</h2>
              <p>
                Rootstock is distributed as a static site over IPFS. It sets no cookies, embeds no
                advertising, and runs no analytics or tracking technologies, including web beacons.
              </p>
            </div>
          </FadeInOnView>
          <FadeInOnView>
            <div className="subsection">
              <h2>2. Local storage, not cookies</h2>
              <p>
                The interface uses browser local storage to function: interface settings, form
                state, wallet-connector session data, and on-chain discovery caches. This stays on
                your own device, is not sent to anyone, and is removed when you clear site data.
              </p>
            </div>
          </FadeInOnView>
          <FadeInOnView>
            <div className="subsection">
              <h2>3. Local development server</h2>
              <p>
                The open-source repository can be run locally as a standard development server. That
                server is a development tool, not the published application; it may set ordinary
                session cookies on the developer's own machine for local testing. It is not operated
                as a public service and does not track anyone.
              </p>
            </div>
          </FadeInOnView>
          <FadeInOnView>
            <div className="subsection">
              <h2>4. Third-party services and gateways</h2>
              <p>
                The application fetches market and chain data from public third-party services; when
                your browser contacts them, their own cookie practices apply. If you reach the app
                through a third-party IPFS gateway, that gateway's practices govern the gateway
                connection itself. We control neither and receive nothing from them.
              </p>
            </div>
          </FadeInOnView>
          <FadeInOnView>
            <div className="subsection">
              <h2>5. Your controls</h2>
              <p>
                Block or clear site data in your browser at any time. This resets the interface to
                defaults and removes stored wallet sessions; it does not affect on-chain activity.
              </p>
            </div>
          </FadeInOnView>
        </div>
      </Prose>
    </Container>
  )
}
