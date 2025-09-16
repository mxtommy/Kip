## Using the Embed Page Viewer Widget

The Embed Page Viewer widget allows you to display external web pages or web applications directly within your dashboard. By default, the Embed Page Viewer widget does not allow input (touch, mouse and keyboard interactions) with the content in the Embed. To enable interactions, check the setting the widget's options. 

While this embedding feature is powerful, it comes with certain limitations due to browser security policies, specifically related to Cross-Origin Resource Sharing (CORS). This guide explains these limitations in simple terms and how they might affect your use of the widget.

## What Are CORS Limitations?

CORS (Cross-Origin Resource Sharing) is a security feature built into web browsers. It prevents one website from accessing resources (like web pages or data) from another website unless the other website explicitly allows it. This is done to protect users from malicious websites trying to steal data or perform unauthorized actions.

When you use the Embed Page Viewer widget, it tries to load the content of the URL you provide into an iframe. However, if the website you are trying to embed does not allow its content to be displayed in an iframe on another website (like embeding their app in your KIP dashboard), the browser will block it. This is not something the widget or Signal K can control—it is a restriction set by the website you are trying to embed.

## Understanding CORS and Hostname/Port Behavior

It is important to clarify that CORS (Cross-Origin Resource Sharing) restrictions are not enforced when the hostname and port of the embedded content match the hostname and port of the KIP dashboard. This is because CORS only applies to requests made across different origins. An origin is defined as a combination of the protocol (e.g., `http` or `https`), hostname (e.g., `localhost` or `example.com`), and optional port (e.g., `80`, `443`, or a custom port). If all those are the same as the ones used by KIP, irrespective of the paths that can be present after the port, it is a same-origin path and CORS restrictions do not apply.

### When CORS Does Not Apply

If the URL you are embedding in the Embed Page Viewer widget uses the same hostname and port as your KIP dashboard (e.g., all Signal K app store applications), the browser considers it to be the same origin. In this case, CORS restrictions do not apply, and the content can be embedded without issues.

#### Examples:

1. **Same Origin (No CORS Restrictions)**:
   - KIP Dashboard URL: `http://localhost:3000/@mxtommy/kip/`
   - Embedded Content URL: `http://localhost:3000/some-page/`
   - Since both KIP and the embedded URL share the same protocol (`http`), hostname (`localhost`), and port (`3000`), CORS does not apply.

2. **Different Origin (CORS Restrictions Apply)**:
   - KIP Dashboard URL: `http://localhost:3000/@mxtommy/kip/`
   - Embedded Content URL: `http://localhost:4000/some-page/`
   - In this case, the ports are different (`3000` vs. `4000`), so the browser considers them to be different origins, and CORS restrictions will apply.

3. **Different Hostname (CORS Restrictions Apply)**:
   - KIP Dashboard URL: `http://dashboard.local/@mxtommy/kip/`
   - Embedded Content URL: `http://example.com/some-page`
   - Even if the ports are the same, the hostnames are different (`dashboard.local` vs. `example.com`), so CORS restrictions will apply.

4. **Different Protocol (CORS Restrictions Apply)**:
   - KIP Dashboard URL: `http://localhost:3000/@mxtommy/kip/`
   - Embedded Content URL: `https://localhost:3000/some-page/`
   - Even though the hostname and port are the same, the protocols are different (`http` vs. `https`), so CORS restrictions will apply.

### IMPORTANT:  Practical Implications for KIP Users

- Embedding webapp and websites is far from perfect. Their are tradeoffs and limitations. If you find yourself unhappy with the result, keep your smile and give back to the community by build a dedicated KIP widget. We will help and many have done so.
- By default you cannot interact with the Embed content. Activate the **Enable Input** widget option if you need to interact with the content.
- If you are hosting custom web pages or applications on the same server as your KIP dashboard, ideally you've created a Signal K webapp and shared it with the community, ensure they use the same hostname and port. Use a relative URL path in the Embed configuration. For example, if your KIP dashboard is running on `http://localhost:3000/@mxtommy/kip/` and your custom content is under the same origin, such as `http://localhost:3000/signalk-anchoralarm-plugin/` simply enter a relative URL in the widget options, like `/signalk-anchoralarm-plugin/`. KIP will automatically add the proper protocol, hostname, port and load the content. This will prevent issues loading the embedded content when launching KIP from different devices such as: the server, on your phone, tablet, laptop, etc.

### Summary

CORS restrictions only apply when the protocol, hostname, or port of the embedded content differs from the KIP dashboard. By ensuring that your embedded content shares the same origin as the dashboard, you can avoid CORS-related issues and seamlessly use the Embed Page Viewer widget.

## How Does This Affect the Embed Widget?

1. **Blocked Content**:
   - If the website you are trying to embed has CORS restrictions or does not allow embedding via iframes, the widget will not display the content. Instead, you might see a blank area or an error message.

2. **Common Examples of Blocked Content**:
   - Many popular websites (e.g., banking sites, social media platforms, or secure portals) block iframe embedding for security reasons.
   - Some websites may allow embedding only for specific trusted domains, which most probably, do not include your Signal K installation.

3. **Consequences of Blocked Content in KIP**:
   - When you enable the "Allow Input" Embed widget option, KIP needs to inject swipe gestures within the embedded application to trigger dashboard navigation, sidebar menu control, or use KIP's keyboard hotkeys while the focus is inside the iframe. To achieve this, KIP dynamically injects scripts into the iframe application. If CORS restrictions apply, this will be prohibited by the browser. This means that gestures and hotkeys will not work over the Embed widget. If you have a full-screen Embed widget, you could get stuck with no way to change dashboards or open menus.

4. **No Workaround for Restricted Websites**:
   - If the application does not allow iframe embedding, there is no way to bypass this restriction without the application owner's adding some kind of authorization for you. This is a browser-enforced security feature.

## How to Use the Embed Widget Effectively

1. **Choose Embed-Friendly Websites**:
   - Use URLs from applications and sites that allow embedding in iframes. For example, all Signal K webapps, Grafana, many public information sites, weather services, or custom web pages you control are good candidates.

2. **Check with the Application Owner**:
   - If you need to embed a specific app, contact the app owner see if they provide a mechanism to add allowed host URL to their app.

## Authorizing KIP to Load Embedded Content

When using the Embed Page Viewer widget, it is important to understand that the ability to display a website or app inside the widget depends on the website or app itself. Specifically, the website being embedded must explicitly allow YOUR PERSONAL SIGNAL K SERVER to load its app or content in an iframe. This can be configured by the embedded app's security settings, which are typically configured using HTTP headers in configuration files.

### What App and Site Owners Need to Do

1. **Allow Embedding in an iframe**:
   - The website must include the `X-Frame-Options` HTTP header or the `Content-Security-Policy` header to explicitly allow embedding.
   - For example:
     - To allow embedding from any domain:
       ```http
       Content-Security-Policy: frame-ancestors *
       ```
     - To allow embedding only from the KIP dashboard (replace `your-signalk-domain.com` with your actual domain):
       ```http
       Content-Security-Policy: frame-ancestors http://your-signalk-domain.com:3000
       ```

2. **Test the Configuration**:
   - After updating the HTTP headers, test the website in the Embed Page Viewer widget. To ensure it loads correctly, look in the Browser's consol log for error messages.
