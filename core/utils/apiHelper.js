class ApiHelper {
  constructor(requestContext) {
    this.requestContext = requestContext;
  }

  async get(endpoint) {
    const response = await this.requestContext.get(endpoint);
    return response.json();
  }

  async post(endpoint, data) {
    const response = await this.requestContext.post(endpoint, { data });
    return response.json();
  }
}

module.exports = { ApiHelper };
