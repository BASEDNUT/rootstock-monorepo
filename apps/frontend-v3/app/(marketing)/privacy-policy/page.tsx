'use client'

import { Box, Container } from '@chakra-ui/react'
import { Prose } from '@nikolovlazar/chakra-ui-prose'
import FadeInOnView from '@repo/lib/shared/components/containers/FadeInOnView'

export default function Privacy() {
  return (
    <Container py="2xl">
      <Prose>
        <div className="pb-4">
          <FadeInOnView>
            <div className="subsection">
              <Box mt="3xl">
                <h1>Rootstock Privacy Policy</h1>
                <p>
                  <em>Last updated: October 2026</em>
                </p>
              </Box>
              <p>
                <em>
                  This policy covers the published static application and explains what the
                  Rootstock interface does with information. Rootstock is maintained by the
                  Rootstock maintainers within the BASED NUT project. Contact: support@basednut.com.
                </em>
              </p>
            </div>
          </FadeInOnView>
          <FadeInOnView>
            <div className="subsection">
              <h2>1. The published app collects nothing</h2>
              <p>
                The application is a static site distributed over IPFS. It sets no cookies, runs no
                analytics, has no accounts, and operates no servers of its own that collect or log
                your activity.
              </p>
            </div>
          </FadeInOnView>
          <FadeInOnView>
            <div className="subsection">
              <h2>2. Your browser, your data</h2>
              <p>
                The interface stores state — form inputs, interface settings, wallet-connector
                session, and on-chain discovery caches — in your browser's local storage. This data
                stays on your device, is never transmitted to us, and can be cleared at any time in
                your browser.
              </p>
            </div>
          </FadeInOnView>
          <FadeInOnView>
            <div className="subsection">
              <h2>3. Your wallet, your keys</h2>
              <p>
                Wallet connection and transaction signing happen entirely inside your wallet.
                Private keys and signatures never pass through the interface, and the interface
                never holds funds.
              </p>
            </div>
          </FadeInOnView>
          <FadeInOnView>
            <div className="subsection">
              <h2>4. Third parties the interface calls</h2>
              <p>
                To display data, the app fetches information from public blockchain nodes and
                third-party data services. Those providers see your IP address and requests and
                handle them under their own privacy policies. On-chain transactions are public by
                nature. IPFS gateways you use to reach the app are independent services; their
                policies govern the gateway connection.
              </p>
            </div>
          </FadeInOnView>
          <FadeInOnView>
            <div className="subsection">
              <h2>5. Wallet screening (advisory only)</h2>
              <p>
                When configured, the interface may consult a third-party risk provider about a
                connected address. The check fails open: when the provider is unavailable or
                unconfigured — the permanent state of the static IPFS deployment — no screening
                happens and no address is restricted. No addresses are collected or retained through
                this feature.
              </p>
            </div>
          </FadeInOnView>
          <FadeInOnView>
            <div className="subsection">
              <h2>6. Your choices</h2>
              <p>
                Clear site data to remove all local state and stored wallet sessions. Point the app
                at your own RPC endpoint if you prefer. Questions: support@basednut.com.
              </p>
            </div>
          </FadeInOnView>
        </div>
      </Prose>
    </Container>
  )
}
