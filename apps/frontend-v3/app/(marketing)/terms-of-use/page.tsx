'use client'

import { Box, Container } from '@chakra-ui/react'
import { Prose } from '@nikolovlazar/chakra-ui-prose'
import FadeInOnView from '@repo/lib/shared/components/containers/FadeInOnView'

export default function Terms() {
  return (
    <Container py="2xl">
      <Prose>
        <div className="pb-4">
          <FadeInOnView>
            <div className="subsection">
              <Box mt="3xl">
                <h1>Rootstock Terms of Use</h1>
                <p>
                  <em>Last updated: October 2026</em>
                </p>
              </Box>
            </div>
          </FadeInOnView>
          <FadeInOnView>
            <div className="subsection">
              <h2>1. Overview</h2>
              <p>
                These Terms of Use (“Terms”) apply to the Rootstock interface — a static,
                content-addressed application distributed over IPFS — and to any person or entity
                that accesses or uses it. By using the interface you agree to be bound by these
                Terms. If you do not agree, do not use it. Do not use the interface where such use
                is prohibited by applicable law.
              </p>
              <p>
                Rootstock is an independent fork of the Balancer v3 protocol, operated by the BASED
                NUT project and maintained by the Rootstock maintainers. Rootstock is not operated
                by, affiliated with, or endorsed by Balancer. Questions: support@basednut.com.
              </p>
              <p>
                <strong>Experimental software.</strong> Rootstock is experimental DeFi software.
                Nothing in the interface is financial, legal, or tax advice. You are solely
                responsible for your transactions, fees, and outcomes. Risk only what you can afford
                to lose.
              </p>
            </div>
          </FadeInOnView>
          <FadeInOnView>
            <div className="subsection">
              <h2>2. Non-custodial interface</h2>
              <p>
                The interface is a non-custodial graphical view of permissionless smart contracts on
                Base. It never holds, custodies, or controls your assets. Every transaction is
                constructed in the interface and signed by you in your own in-browser wallet. The
                same contracts can be reached through other interfaces; this interface is not
                required to use them. There are no user accounts and no account-based services.
              </p>
            </div>
          </FadeInOnView>
          <FadeInOnView>
            <div className="subsection">
              <h2>3. Static distribution</h2>
              <p>
                The application is served from IPFS. Copies and third-party gateways may exist
                outside our control; the interface may be reached through gateways we do not
                operate. Verify the content address (CID) you load when it matters to you.
              </p>
            </div>
          </FadeInOnView>
          <FadeInOnView>
            <div className="subsection">
              <h2>4. Third parties</h2>
              <p>
                Wallets, RPC providers, explorers, and data services are independent third parties
                governed by their own terms; we do not control them. Third-party risk screening,
                when configured, is advisory only and never blocks a transaction — every transaction
                is signed in your own wallet.
              </p>
            </div>
          </FadeInOnView>
          <FadeInOnView>
            <div className="subsection">
              <h2>5. Eligibility</h2>
              <p>
                You must be of legal age and capacity to form binding contracts, and you must not be
                located in, or a citizen or resident of, a jurisdiction where use of this interface
                is prohibited, nor be on any sanctions list.
              </p>
            </div>
          </FadeInOnView>
          <FadeInOnView>
            <div className="subsection">
              <h2>6. No warranties; limitation of liability</h2>
              <p>
                The interface is provided “as is,” without warranties of any kind. To the maximum
                extent permitted by law, the Rootstock maintainers are not liable for any losses
                arising from use of the interface or the protocol, including losses from smart
                contract defects, transaction errors, or third-party actions.
              </p>
            </div>
          </FadeInOnView>
          <FadeInOnView>
            <div className="subsection">
              <h2>7. Changes and disputes</h2>
              <p>
                Updated Terms are posted with a new date; continued use constitutes acceptance.
                Raise issues first at support@basednut.com. These Terms are governed by the law of
                the operator's jurisdiction, and disputes are subject to the courts of that
                jurisdiction.
              </p>
            </div>
          </FadeInOnView>
        </div>
      </Prose>
    </Container>
  )
}
