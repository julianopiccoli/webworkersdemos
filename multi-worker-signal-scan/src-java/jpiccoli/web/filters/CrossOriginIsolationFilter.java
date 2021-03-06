package jpiccoli.web.filters;

import java.io.IOException;

import javax.servlet.Filter;
import javax.servlet.FilterChain;
import javax.servlet.FilterConfig;
import javax.servlet.ServletException;
import javax.servlet.ServletRequest;
import javax.servlet.ServletResponse;
import javax.servlet.http.HttpServletResponse;

/**
 * Filter that adds the headers "Cross-Origin-Opener-Policy" and "Cross-Origin-Embedder-Policy"
 * to every response generated by the server. The values "same-origin" and "require-corp"
 * create the condition required by some browsers to allow the usage of SharedArrayBuffers.
 * 
 * @author Piccoli
 *
 */
public class CrossOriginIsolationFilter implements Filter {

	@Override
	public void init(FilterConfig filterConfig) throws ServletException {
		// Nothing to do here.
	}
	
	@Override
	public void destroy() {
		// Nothing to do here.
	}

	@Override
	public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
			throws IOException, ServletException {
		if (response instanceof HttpServletResponse) {
			HttpServletResponse httpResponse = (HttpServletResponse) response;
			httpResponse.setHeader("Cross-Origin-Opener-Policy", "same-origin");
			httpResponse.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
		}
		chain.doFilter(request, response);
	}

}
